// Which sessions have a channel server waiting on their feedback, the long polls it waits in, and
// whether each session is mid-turn. In memory only: a channel server polls again within seconds after a restart.
import type { FeedbackVia, IncomingEvent } from '../shared/types'

/** A session counts as live this long after its last poll ended, covering the gap between polls */
export const CHANNEL_GRACE_MS = 30_000

/** Mid-turn (a hook will pick feedback up at its next tool call or Stop) or idle (only a channel reaches it) */
export type Activity = 'busy' | 'idle'

/** What the server saw a session do: a feedback claim (from a hook, or a channel push) or an ingested event */
export type ActivitySignal
  = | { claim: FeedbackVia, claimed: number }
    | { event: IncomingEvent['kind'] }

/**
 * The session's state after a signal, or null when the signal says nothing new. A channel claims only
 * from an idle session, so feedback sent mid-turn reaches it through the hook as before.
 * - A prompt or a tool call means a turn is running; so does a question (PreToolUse).
 * - A Stop that claimed feedback continues the turn; one that claimed nothing ends it.
 * - A channel push starts a turn, which may not run a prompt hook.
 * - SessionStart begins idle. A recap says nothing on its own: it races the Stop's claim, which decides.
 */
export function activityAfter(signal: ActivitySignal): Activity | null {
  if ('claim' in signal) {
    if (signal.claim === 'stop' || signal.claim === 'channel')
      return signal.claimed > 0 ? 'busy' : signal.claim === 'stop' ? 'idle' : null
    return 'busy'
  }
  if (signal.event === 'session')
    return 'idle'
  return signal.event === 'question' || signal.event === 'image' ? 'busy' : null
}

export class ChannelLiveness {
  /** Sessions mid-turn; a session not listed (never seen, just started) counts as idle */
  private busy = new Set<string>()

  private polls = new Map<string, number>()
  private lastSeen = new Map<string, number>()
  private waiters = new Map<string, Set<() => void>>()

  constructor(private readonly graceMs = CHANNEL_GRACE_MS) {}

  isIdle(sessionId: string): boolean {
    return !this.busy.has(sessionId)
  }

  /** Applies what the session did; a session that turns idle wakes its waiting polls, so pending feedback goes out */
  observe(sessionId: string, signal: ActivitySignal): void {
    const next = activityAfter(signal)
    if (!next)
      return
    const wasIdle = this.isIdle(sessionId)
    if (next === 'busy')
      this.busy.add(sessionId)
    else
      this.busy.delete(sessionId)
    if (next === 'idle' && !wasIdle)
      this.wake(sessionId)
  }

  /** A poll opened for the session */
  begin(sessionId: string, now = Date.now()): void {
    this.polls.set(sessionId, (this.polls.get(sessionId) ?? 0) + 1)
    this.lastSeen.set(sessionId, now)
  }

  /** A poll for the session returned or its client went away */
  end(sessionId: string, now = Date.now()): void {
    const open = (this.polls.get(sessionId) ?? 0) - 1
    if (open > 0)
      this.polls.set(sessionId, open)
    else
      this.polls.delete(sessionId)
    this.lastSeen.set(sessionId, now)
  }

  /** A poll is open, or one ended within the grace period */
  isLive(sessionId: string, now = Date.now()): boolean {
    if (this.polls.has(sessionId))
      return true
    const seen = this.lastSeen.get(sessionId)
    return seen !== undefined && now - seen < this.graceMs
  }

  /** Resolves when `wake` is called for the session, after `ms`, or when `signal` aborts, whichever comes first */
  wait(sessionId: string, ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal?.aborted)
        return resolve()
      let set = this.waiters.get(sessionId)
      if (!set)
        this.waiters.set(sessionId, set = new Set())
      let timer: ReturnType<typeof setTimeout> | undefined
      const done = () => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', done)
        const current = this.waiters.get(sessionId)
        current?.delete(done)
        if (current?.size === 0)
          this.waiters.delete(sessionId)
        resolve()
      }
      timer = setTimeout(done, ms)
      signal?.addEventListener('abort', done)
      set.add(done)
    })
  }

  /** Feedback was queued for the session, or the session moved: every poll waiting on it returns */
  wake(sessionId: string): void {
    for (const done of [...this.waiters.get(sessionId) ?? []]) done()
  }
}
