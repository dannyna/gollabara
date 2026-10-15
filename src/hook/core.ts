// `golla hook` — the shared hook core that runs Claude Code's and Codex CLI's hooks: event posting, the
// feedback claim, budgets, image roles from the filesystem, and the health log. What differs per harness
// comes from its adapter (claude-code.ts, codex.ts).
// Never blocks the session: short timeout, swallow every error, always exit 0.
// Stdout carries only the feedback JSON for the session, and only when there is feedback.

import type { Feedback, Harness, ImageRole } from '../shared/types'
import type { Adapter, HookInput } from './map'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { dataDir, serverUrl } from '../shared/config'
import { HOOK_HARNESS_HEADER, HOOK_VERSION_HEADER, PLUGIN_VERSION } from '../shared/version'
import { errorClass, HttpError, logHealth } from './health'
import { ADAPTERS, feedbackOutput, feedbackVia, imageRole, mapHook, sessionInfo, sessionStartedAt } from './map'
import { fromTail, readHead, TRANSCRIPT_HEAD_BYTES, TRANSCRIPT_TAIL_WINDOWS } from './transcript'

/**
 * A hard deadline for every mode but `wait`: past the 1.5 s request budget, whatever still runs (a slow
 * transcript read, a stalled stdin) is cut and the hook exits 0, before the harness's own timeout kills
 * it and reports a failure (Codex shows that in its TUI).
 */
export const HARD_DEADLINE_MS = 2500
const POST_TIMEOUT_MS = 1500

/**
 * `adapter` comes from the hook command (`hook.js codex`), never from env. Codex differs in three ways:
 * no turn opener to read (every Stop posts its recap), turn starts from its rollout, and feedback at
 * Stop goes out as `decision: block`, never while the turn is already continuing.
 */
export async function runHook(adapter: Adapter = 'claude-code'): Promise<void> {
  // Set by gollabara's own background model calls so they never stream themselves
  if (process.env.GOLLABARA_HOOK === 'off')
    return
  const started = performance.now()
  let health: { event: string, harness?: Harness, ms: number, error?: string } | undefined
  try {
    const raw = await Bun.stdin.text()
    const input = JSON.parse(raw) as HookInput
    // Pick only the keys we use: the rest of the env can hold tool tokens
    const session = sessionInfo(input, { OD_PROJECT_ID: process.env.OD_PROJECT_ID }, { projectRoot, readBranch }, adapter)
    health = { event: input.hook_event_name, harness: session.harness, ms: 0 }
    const opener = input.hook_event_name === 'Stop' ? ADAPTERS[adapter].stopOpener(input.transcript_path) : 'unknown'
    const event = mapHook(input, session, opener, path => readFileRole(path, input.transcript_path, TRANSCRIPT_TAIL_WINDOWS, adapter))
    // Claude Code and Codex run the hook command as their direct child (a one-command `sh -c` execs it), so every
    // hook, the wake-up waiter included, sees the harness pid as its parent
    if (event?.kind === 'session')
      event.pid = process.ppid
    const via = feedbackVia(input.hook_event_name, input, adapter)
    // Event and claim share one budget and run side by side; most tool calls only claim
    const signal = AbortSignal.timeout(POST_TIMEOUT_MS)
    // The version headers let the server flag an outdated plugin (`golla doctor`)
    const post = (path: string, body: unknown) => fetch(`${serverUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [HOOK_VERSION_HEADER]: PLUGIN_VERSION, [HOOK_HARNESS_HEADER]: session.harness },
      body: JSON.stringify(body),
      signal,
    }).then((r) => {
      if (!r.ok)
        throw new HttpError(r.status)
      return r
    })
    const results = await Promise.allSettled([
      event ? post('/api/events', event) : null,
      via ? post('/api/feedback/claim', { sessionId: session.id, via }).then(r => r.json() as Promise<Feedback[]>) : [],
    ])
    // A run that sent nothing (no event, no claim) is not logged
    if (event || via) {
      const failed = results.find(r => r.status === 'rejected')
      health = { ...health, ms: Math.round(performance.now() - started), ...(failed ? { error: errorClass(failed.reason) } : {}) }
    }
    else {
      health = undefined
    }
    const claimed = results[1]
    const items = claimed.status === 'fulfilled' && Array.isArray(claimed.value) ? claimed.value : []
    const output = feedbackOutput(input.hook_event_name, items, adapter)
    // Awaited so the bytes are out before entry.ts calls process.exit
    if (output)
      await Bun.write(Bun.stdout, JSON.stringify(output))
  }
  catch {
    // The session keeps going even if the server is down
    health = { event: health?.event ?? 'unknown', harness: health?.harness, ms: Math.round(performance.now() - started), error: 'error' }
  }
  // After the output is out, so the session never waits on the log
  if (health)
    logHealth(dataDir(), { at: Date.now(), ...health, ok: !health.error })
}

/**
 * When the current turn started, from its opener in the transcript's tail, else when the session
 * started (the transcript's head); undefined when neither can be read
 */
export function turnStart(transcriptPath?: string, windows = TRANSCRIPT_TAIL_WINDOWS, adapter: Adapter = 'claude-code'): number | undefined {
  const opened = fromTail(transcriptPath, ADAPTERS[adapter].turnStartedAt, windows)
  if (opened !== undefined || !transcriptPath)
    return opened
  const head = readHead(transcriptPath, TRANSCRIPT_HEAD_BYTES)
  return head === undefined ? undefined : sessionStartedAt(head)
}

/**
 * The role of images read from `path`: an artifact when the file changed after the turn started.
 * Only image reads get here, so other tool calls never stat. Any error makes it an artifact.
 */
export function readFileRole(path: string, transcriptPath?: string, windows = TRANSCRIPT_TAIL_WINDOWS, adapter: Adapter = 'claude-code'): ImageRole {
  try {
    return imageRole(statSync(path).mtimeMs, turnStart(transcriptPath, windows, adapter))
  }
  catch {
    return 'artifact'
  }
}

export function projectRoot(cwd: string): string {
  // `.git` is a dir in a plain clone and a file in worktrees and submodules
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git')))
      return dir
    if (dirname(dir) === dir)
      return cwd
  }
}

export function readBranch(root: string): string | undefined {
  try {
    const dotGit = join(root, '.git')
    let gitDir = dotGit
    if (statSync(dotGit).isFile()) {
      const line = readFileSync(dotGit, 'utf8').trim()
      if (!line.startsWith('gitdir:'))
        return undefined
      gitDir = resolve(root, line.slice('gitdir:'.length).trim())
    }
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim()
    return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : undefined
  }
  catch {
    return undefined
  }
}
