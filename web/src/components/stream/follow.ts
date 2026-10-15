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
