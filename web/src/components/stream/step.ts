// Moving the rail one cell at a time. Pure, so the landing rule is testable without a DOM;
// StreamRail feeds it the scroll position and each visible cell's left edge.

/** Wheel or trackpad travel, in px, that counts as one step (one mouse-wheel notch is ~100) */
export const WHEEL_STEP_PX = 40
/** A pause this long between wheel events ends a gesture */
export const WHEEL_QUIET_MS = 150
/** If `scrollend` never fires (older browsers, no movement), the step counts as settled after this */
export const SETTLE_FALLBACK_MS = 1000
/** A gesture whose |delta| drops to this share of its peak is coasting: a trackpad's momentum tail */
const TAIL_FALL = 0.6
/** Coasting input that climbs back above RISE × its low + RISE_PX is a new swipe, not the tail */
const RISE = 1.5
const RISE_PX = 4
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

/**
 * One wheel gesture: a mouse notch burst, a trackpad swipe and its momentum tail, or a
 * smooth-scroll mouse's stream. Momentum tails keep sending wheel events for a second or
 * two, so a quiet gap alone cannot end a gesture: a swipe that starts during the tail
 * shows up as |delta| climbing again after it decayed.
 */
export interface Wheel {
  at: number
  sign: number
  peak: number
  /** Smallest |delta| since the gesture started coasting, or null while it has not */
  low: number | null
  /** The last few |delta|s, for a rise that one jittery event cannot fake */
  recent: number[]
  /** Travel toward the next step; only input that is not a coasting tail counts */
  travel: number
  /** Whether the gesture may step: always at its start, then again once its last step settled */
  ready: boolean
  /** The gesture already stepped, so its coasting tail no longer counts */
  stepped: boolean
}

function startsGesture(w: Wheel | undefined, now: number, delta: number, mag: number) {
  if (!w || now - w.at > WHEEL_QUIET_MS)
    return true
  if (delta !== 0 && w.sign !== 0 && Math.sign(delta) !== w.sign)
    return true
  if (w.low === null)
    return false
  const window = [...w.recent.slice(-2), mag]
  return window.reduce((sum, m) => sum + m, 0) / window.length >= w.low * RISE + RISE_PX
}

/**
 * Reads one wheel event (delta in px, as from wheelDelta) and says whether to step:
 * 1 or -1, or 0 for no step. A gesture steps once as soon as it travels WHEEL_STEP_PX;
 * it steps again only after `wheelSettled` and only on input that is not coasting, so a
 * steady stream keeps stepping one cell per scroll while a momentum tail adds no step.
 */
export function wheelInput(w: Wheel | undefined, now: number, delta: number): { wheel: Wheel, dir: -1 | 0 | 1 } {
  const mag = Math.abs(delta)
  let next: Wheel
  if (startsGesture(w, now, delta, mag)) {
    next = { at: now, sign: Math.sign(delta), peak: mag, low: null, recent: [mag], travel: 0, ready: true, stepped: false }
  }
  else {
    const prev = w!
    const peak = prev.low === null ? Math.max(prev.peak, mag) : prev.peak
    const low = prev.low !== null ? Math.min(prev.low, mag) : mag <= peak * TAIL_FALL ? mag : null
    next = { ...prev, at: now, sign: prev.sign || Math.sign(delta), peak, low, recent: [...prev.recent.slice(-2), mag] }
  }
  if (!next.ready || (next.low !== null && next.stepped))
    return { wheel: next, dir: 0 }
  next.travel += delta
  if (Math.abs(next.travel) < WHEEL_STEP_PX)
    return { wheel: next, dir: 0 }
  const dir = next.travel > 0 ? 1 : -1
  return { wheel: { ...next, travel: 0, ready: false, stepped: true }, dir }
}

/** The step's scroll settled: continued input on the same gesture may step again */
export const wheelSettled = (w: Wheel | undefined): Wheel | undefined => w && { ...w, ready: true }
