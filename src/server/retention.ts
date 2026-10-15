// 「보관 기간」 (#78): the server deletes what is older than the window, at start, hourly, and when the window changes.

import type { Retention } from '../shared/types'

/** How often the server prunes while it runs */
export const PRUNE_EVERY_MS = 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The time before which messages go, or null to keep everything: `forever`, or never chosen. An unset
 * window never prunes, so an upgrade deletes nothing before a device seeds the choice it kept locally.
 */
export function pruneBefore(retention: Retention | undefined, now: number): number | null {
  if (!retention || retention === 'forever')
    return null
  return now - Number(retention) * DAY_MS
}
