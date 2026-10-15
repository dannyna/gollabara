// Moving the rail one cell at a time. Pure, so the landing rule is testable without a DOM;
// StreamRail feeds it the scroll position and each visible cell's left edge.

/** Wheel or trackpad travel, in px, that counts as one step (one mouse-wheel notch is ~100) */
export const WHEEL_STEP_PX = 40
/** A swipe's momentum tail keeps sending wheel events; wait this long without any before the next step */
export const WHEEL_QUIET_MS = 150
/** If `scrollend` never fires (older browsers, no movement), the step counts as settled after this */
export const SETTLE_FALLBACK_MS = 600
/** Within this many px a cell already sits on the anchor */
const TOLERANCE = 1

/**
 * The scrollLeft that puts the next (dir 1) or previous (dir -1) cell's left edge on the
 * anchor, the rail's content start. `starts` are the cells' left edges in scroll
 * coordinates, ascending; `max` is scrollWidth − clientWidth. Cells near the end cannot
 * reach the anchor, so they clamp to `max`. Returns null when there is nowhere to go.
 */
export function stepTarget(scrollLeft: number, starts: number[], dir: 1 | -1, anchor: number, max: number): number | null {
  const lefts = starts.map(s => Math.min(max, Math.max(0, s - anchor)))
  if (dir > 0) {
    const next = lefts.find(l => l > scrollLeft + TOLERANCE)
    return next ?? null
  }
  const prev = lefts.findLast(l => l < scrollLeft - TOLERANCE)
  return prev ?? (scrollLeft > TOLERANCE ? 0 : null)
}

/** The scrollLeft that puts one cell on the anchor, e.g. when its chat thumbnail is picked */
export const alignTarget = (start: number, anchor: number, max: number) => Math.min(max, Math.max(0, start - anchor))

/** Wheel delta in px along whichever axis moved more; line and page modes are converted */
export function wheelDelta(e: { deltaX: number, deltaY: number, deltaMode: number }, pageWidth: number): number {
  const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  return e.deltaMode === 1 ? raw * 16 : e.deltaMode === 2 ? raw * pageWidth : raw
}
