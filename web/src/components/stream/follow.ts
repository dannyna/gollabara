// Following the latest artifact (OD stream guide 05). Pure, so the rules are testable
// without a DOM; StreamPanel feeds it scroll positions and artifact lists.

import type { Artifact } from '../../artifacts'

/**
 * `start`: just opened at the latest, nothing scrolled yet.
 * `following`: within FOLLOW_EDGE of the right end, new cells pull the rail along.
 * `paused`: the reader went back; the rail stays put and 「새 산출물 n →」 counts arrivals.
 */
export type Follow = 'start' | 'following' | 'paused'

/** Closer than this to the right end counts as being at the latest */
export const FOLLOW_EDGE = 70

export const FOLLOW_TEXT: Record<Follow, string> = {
  start: '최신 산출물 · 오른쪽 끝 →',
  following: '최신 산출물 · 따라가는 중',
  paused: '이전 산출물 · 자동 따라가기 일시 정지',
}

export function atLatest(el: { scrollWidth: number, clientWidth: number, scrollLeft: number }) {
  return el.scrollWidth - el.clientWidth - el.scrollLeft < FOLLOW_EDGE
}

export const lastArrival = (artifacts: Artifact[]) => artifacts.reduce((n, a) => Math.max(n, a.arrival), 0)

/**
 * Cells that actually got a new capture since `seen`: a new screen, or a new capture of
 * one already on the rail (its cell moved to the end). Cells that only became visible
 * (a session unmuted, the scope widened) carry older arrivals, so they never count, and
 * neither do arrivals from muted or out-of-scope sessions, which are not in the list at all.
 */
export const arrivedSince = (seen: number, artifacts: Artifact[]) => artifacts.filter(a => a.arrival > seen).length

/** Footer text while a pin holds the rail, in place of the follow state */
export const PINNED_TEXT = '고정됨 · 클릭해서 풀기'

export const followText = (follow: Follow, pinned: boolean) => pinned ? PINNED_TEXT : FOLLOW_TEXT[follow]

/** Clicking a cell pins it; clicking the pinned cell again unpins. One pin at a time. */
export const togglePin = (pinned: string | null, key: string) => pinned === key ? null : key

/**
 * The pin while its cell is on the rail, else null. A pin whose cell is muted, out of
 * scope, or gone stays stored but holds nothing: the rail follows as usual.
 */
export const activePin = (pinned: string | null | undefined, keys: ReadonlySet<string>) => pinned && keys.has(pinned) ? pinned : null

/**
 * The cell to hold in place when captures arrive: the pin, unless a new capture of it
 * just moved its cell to the end. Then, like without a pin, null asks for the first cell
 * in view that did not move, so the reader stays where they were instead of being
 * carried to the end with it.
 */
export const holdKey = (pin: string | null, moved: ReadonlySet<string>) => pin && !moved.has(pin) ? pin : null

/**
 * What the rail does after its list changed:
 * - `reveal`: put `key` on the anchor (a new scope, or muting reshuffled the cells)
 * - `latest`: scroll to the right end and follow
 * - `hold`: keep the view where it was; 「새 산출물 n →」 counts the arrivals
 * - `none`: nothing arrived and nothing moved
 */
export type ListMove = { move: 'reveal', key: string } | { move: 'latest' | 'hold' | 'none' }

export function listMove(c: {
  scopeChanged: boolean
  reshuffled: boolean
  arrived: number
  follow: Follow
  /** The active pin (activePin) in the new list */
  pin: string | null
  selected: string | null
  keys: ReadonlySet<string>
}): ListMove {
  if (c.scopeChanged)
    return c.pin ? { move: 'reveal', key: c.pin } : { move: 'latest' }
  // Muting keeps the reader on the cell they pinned, or else the one they picked
  const keep = c.pin ?? (c.selected && c.keys.has(c.selected) ? c.selected : null)
  if (c.reshuffled && keep)
    return { move: 'reveal', key: keep }
  if (!c.arrived)
    return { move: 'none' }
  return c.follow !== 'paused' && !c.pin ? { move: 'latest' } : { move: 'hold' }
}
