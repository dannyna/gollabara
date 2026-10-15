// Which sessions have a channel server waiting on their feedback, and the long polls it waits in.
// In memory only: a channel server polls again within seconds after a restart.

/** A session counts as live this long after its last poll ended, covering the gap between polls */
export const CHANNEL_GRACE_MS = 30_000

export class ChannelLiveness {
  private polls = new Map<string, number>()
  private lastSeen = new Map<string, number>()
  private waiters = new Map<string, Set<() => void>>()

  constructor(private readonly graceMs = CHANNEL_GRACE_MS) {}

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
