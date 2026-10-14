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

export const lastSeq = (artifacts: Artifact[]) => artifacts.reduce((n, a) => Math.max(n, a.seq), 0)

/**
 * Artifacts that actually arrived since `seenSeq`. Cells that only became visible
 * (a session unmuted, the scope widened) carry older sequence numbers, so they never
 * count, and neither do arrivals from muted or out-of-scope sessions, which are not
 * in the list at all.
 */
export const arrivedSince = (seenSeq: number, artifacts: Artifact[]) => artifacts.filter(a => a.seq > seenSeq).length
