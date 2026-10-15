// `golla hook wait` — the wake-up Stop hook. Claude Code runs it in the background (`asyncRewake`), so it
// never blocks the session. It waits for the user's feedback while the session is idle; exit code 2 wakes
// the session and shows it the stderr text. Every other ending is a quiet exit 0, and a headless run
// (`claude -p`, the Agent SDK) exits at once.

import type { Feedback } from '../shared/types'
import type { HookInput } from './map'
import process from 'node:process'
import { serverUrl } from '../shared/config'
import { feedbackText } from '../shared/feedback'
import { HOOK_VERSION_HEADER, PLUGIN_VERSION } from '../shared/version'

/**
 * plugin/hooks/hooks.json gives the hook 24 h. Claude Code kills it then without a trace, and feedback
 * claimed in that instant would be lost, so the waiter leaves well before.
 */
export const WAIT_BUDGET_MS = (86_400 - 600) * 1000
/** Longer than the server's 25 s wait, so a healthy poll never times out here */
const POLL_TIMEOUT_MS = 35_000
/** A server restart (`bun run dev`) takes a few seconds; one that stays down ends the wait */
const DOWN_RETRIES = 3
const DOWN_RETRY_MS = 10_000

/** One long poll: feedback (maybe none yet), the server telling the waiter to stop (410), or no answer */
export type PollResult = { items: Feedback[] } | 'stop' | 'down'

export interface WaitOptions {
  /** When the waiter must be gone */
  deadline: number
  now?: () => number
  sleep?: (ms: number) => Promise<unknown>
  /** False once Claude Code is gone */
  alive?: () => boolean
}

/** Polls until feedback arrives (returned) or the wait ends (null) */
export async function waitForFeedback(poll: () => Promise<PollResult>, options: WaitOptions): Promise<Feedback[] | null> {
  const { deadline, now = Date.now, sleep = Bun.sleep, alive = () => true } = options
  let down = 0
  while (alive() && now() + POLL_TIMEOUT_MS < deadline) {
    const result = await poll()
    if (result === 'stop')
      return null
    if (result === 'down') {
      if (++down > DOWN_RETRIES)
        return null
      await sleep(DOWN_RETRY_MS)
      continue
    }
    down = 0
    if (result.items.length)
      return result.items
  }
  return null
}

/**
 * Whether the session is headless. Claude Code marks a non-interactive run's entrypoint `sdk-cli`
 * (`claude -p`), and the Agent SDK sets `sdk-ts` or `sdk-py`. Such a run waits for its background hooks
 * before it exits, and nothing there ends a wait, so a waiter would hold it open for its whole budget.
 */
export function headless(entrypoint: string | undefined): boolean {
  return entrypoint?.startsWith('sdk-') ?? false
}

/** Exit code for the hook process: 2 wakes the session with the feedback on stderr, 0 is quiet */
export async function runWait(): Promise<number> {
  // Set by gollabara's own background model calls so they never stream themselves
  if (process.env.GOLLABARA_HOOK === 'off' || headless(process.env.CLAUDE_CODE_ENTRYPOINT))
    return 0
  try {
    const input = JSON.parse(await Bun.stdin.text()) as HookInput
    if (!input.session_id)
      return 0
    // Claude Code is the parent; a new parent means it is gone and this waiter must not claim anything
    const pid = process.ppid
    const alive = () => process.ppid === pid
    // Ids grow with the start time, so the server lets a newer Stop's waiter replace this one
    const waiter = performance.timeOrigin
    const url = `${serverUrl()}/api/channel/wait?${new URLSearchParams({ session: input.session_id, pid: String(pid), waiter: String(waiter) })}`
    const poll = async (): Promise<PollResult> => {
      const abort = new AbortController()
      const timer = setTimeout(() => abort.abort(), POLL_TIMEOUT_MS)
      // An open poll the server answers after Claude Code is gone would claim feedback no one reads
      const watch = setInterval(() => alive() || abort.abort(), 1000)
      try {
        // The server takes the harness from the session record
        const res = await fetch(url, { signal: abort.signal, headers: { [HOOK_VERSION_HEADER]: PLUGIN_VERSION } })
        if (res.ok)
          return { items: await res.json() as Feedback[] }
        return res.status >= 500 ? 'down' : 'stop'
      }
      catch {
        return alive() ? 'down' : 'stop'
      }
      finally {
        clearTimeout(timer)
        clearInterval(watch)
      }
    }
    const items = await waitForFeedback(poll, { deadline: Date.now() + WAIT_BUDGET_MS, alive })
    if (!items?.length)
      return 0
    await Bun.write(Bun.stderr, feedbackText(items))
    return 2
  }
  catch {
    return 0
  }
}
