// Expiry (#116): gollabara keeps a session's data while it lives, plus an hour. The server deletes
// what expired at start and every minute.

/** How long an ended session's record, messages, feedback and images stay */
export const ENDED_KEEP_MS = 60 * 60 * 1000

/** How long a cached hide verdict stays unused: shared text, tied to no session */
export const CACHE_KEEP_MS = 7 * 24 * 60 * 60 * 1000

/** How often the server expires while it runs */
export const EXPIRE_EVERY_MS = 60 * 1000

/** The cutoffs for `Store.expire` at `now` */
export function expiryCutoffs(now: number): { endedBefore: number, cacheBefore: number } {
  return { endedBefore: now - ENDED_KEEP_MS, cacheBefore: now - CACHE_KEEP_MS }
}
