import type { Artifact } from '../../artifacts'
import type { Wheel } from './step'
import { describe, expect, it } from 'bun:test'
import { feedbackTargetOf } from '../overlay/useFeedbackTarget'
import { activePin, arrivedSince, atLatest, holdKey, lastArrival, latestLeft, listMove, PINNED_TEXT, togglePin } from './follow'
import { alignTarget, stepTarget, wheelDelta, wheelInput, wheelSettled } from './step'

function cell(seq: number, extra: Partial<Artifact> = {}): Artifact {
  return {
    key: `${seq}-0`,
    messageId: seq,
    url: `/img/${seq}.png`,
    width: 1440,
    height: 900,
    sessionId: 's',
    session: 's',
    at: seq * 1000,
    runStart: false,
    seq,
    arrival: seq,
    turnIndex: 0,
    ...extra,
  }
}

describe('follow', () => {
  it('follows within 70px of the right end', () => {
    expect(atLatest({ scrollWidth: 2000, clientWidth: 800, scrollLeft: 1131 })).toBe(true)
    expect(atLatest({ scrollWidth: 2000, clientWidth: 800, scrollLeft: 1130 })).toBe(false)
  })

  it('a fold after a wide latest cell never pushes that cell off the anchor', () => {
    // The latest cell aligns at 1100, a trailing 「참고 이미지」 fold makes the end 1200
    expect(latestLeft(1200, 1100)).toBe(1100)
    expect(atLatest({ scrollWidth: 2000, clientWidth: 800, scrollLeft: 1100 }, 1100)).toBe(true)
    expect(atLatest({ scrollWidth: 2000, clientWidth: 800, scrollLeft: 1200 }, 1100)).toBe(true)
    expect(atLatest({ scrollWidth: 2000, clientWidth: 800, scrollLeft: 1030 }, 1100)).toBe(false)
    // When cell and fold fit, alignTarget already clamps to the end; no cell follows the end
    expect(latestLeft(1200, 1200)).toBe(1200)
    expect(latestLeft(1200, null)).toBe(1200)
  })

  it('counts arrivals only, not cells that reappear after an unmute', () => {
    const before = [cell(1), cell(4)]
    // Unmuted cells 2 and 3 are older than what was seen; 5 is new
    expect(arrivedSince(lastArrival(before), [cell(1), cell(2), cell(3), cell(4), cell(5)])).toBe(1)
    expect(arrivedSince(lastArrival(before), before)).toBe(0)
  })
})

describe('pin', () => {
  const keys = new Set(['1-0', '2-0', '3-0'])
  const base = { scopeChanged: false, reshuffled: false, arrived: 0, follow: 'following' as const, pin: null, selected: null, keys }

  it('pins a clicked cell, moves the pin to another, and lets go on the pinned one', () => {
    expect(togglePin(null, '2-0')).toBe('2-0')
    expect(togglePin('2-0', '3-0')).toBe('3-0')
    expect(togglePin('2-0', '2-0')).toBeNull()
  })

  it('holds nothing while its cell is not on the rail', () => {
    expect(activePin('2-0', keys)).toBe('2-0')
    expect(activePin('9-0', keys)).toBeNull()
    expect(activePin(null, keys)).toBeNull()
  })

  it('holds the view on arrivals instead of following, even from the right end', () => {
    expect(listMove({ ...base, arrived: 1 })).toEqual({ move: 'latest' })
    expect(listMove({ ...base, arrived: 1, pin: '2-0' })).toEqual({ move: 'hold' })
    expect(listMove({ ...base, arrived: 1, follow: 'paused' })).toEqual({ move: 'hold' })
    expect(listMove({ ...base, pin: '2-0' })).toEqual({ move: 'none' })
  })

  it('holds the pinned cell, or the reader\'s place when a re-capture moved it to the end', () => {
    expect(holdKey('2-0', new Set(['3-0']))).toBe('2-0')
    expect(holdKey('2-0', new Set(['2-0']))).toBeNull()
    expect(holdKey(null, new Set())).toBeNull()
  })

  it('opens a new scope on the pin when it is there, else at the latest', () => {
    expect(listMove({ ...base, scopeChanged: true, pin: '2-0' })).toEqual({ move: 'reveal', key: '2-0' })
    expect(listMove({ ...base, scopeChanged: true, selected: '1-0' })).toEqual({ move: 'latest' })
  })

  it('keeps the pinned cell, else the selected one, in view when muting reshuffles the rail', () => {
    expect(listMove({ ...base, reshuffled: true, pin: '2-0', selected: '1-0' })).toEqual({ move: 'reveal', key: '2-0' })
    expect(listMove({ ...base, reshuffled: true, selected: '1-0' })).toEqual({ move: 'reveal', key: '1-0' })
    expect(listMove({ ...base, reshuffled: true, selected: '9-0', arrived: 1 })).toEqual({ move: 'latest' })
  })

  it('tells how to let go in the footer: Esc with a keyboard, a tap on touch', () => {
    expect(`${PINNED_TEXT.lead} · ${PINNED_TEXT.key}`).toBe('고정한 산출물 · Esc로 풀기')
    expect(`${PINNED_TEXT.lead} · ${PINNED_TEXT.touch}`).toBe('고정한 산출물 · 다시 눌러 풀기')
  })
})

describe('stepTarget', () => {
  // Cells start at 26, 336, 656, 966 in scroll coordinates; the anchor is the 26px padding
  const starts = [26, 336, 656, 966]
  const max = 800

  it('lands the next or previous cell exactly on the anchor', () => {
    expect(stepTarget(0, starts, 1, 26, max)).toBe(310)
    expect(stepTarget(310, starts, 1, 26, max)).toBe(630)
    expect(stepTarget(630, starts, -1, 26, max)).toBe(310)
    // Halfway between cells: forward goes to the next, back to the one just passed
    expect(stepTarget(400, starts, 1, 26, max)).toBe(630)
    expect(stepTarget(400, starts, -1, 26, max)).toBe(310)
  })

  it('treats a cell within 1px of the anchor as already there', () => {
    expect(stepTarget(309.5, starts, 1, 26, max)).toBe(630)
    expect(stepTarget(310.5, starts, -1, 26, max)).toBe(0)
  })

  it('clamps at both ends and stops there', () => {
    // The last cell cannot reach the anchor: it lands at the end
    expect(stepTarget(630, starts, 1, 26, max)).toBe(800)
    expect(stepTarget(800, starts, 1, 26, max)).toBeNull()
    expect(stepTarget(0, starts, -1, 26, max)).toBeNull()
    expect(stepTarget(5, [26], -1, 26, max)).toBe(0)
  })

  it('aligns one cell to the anchor, within the scroll range', () => {
    expect(alignTarget(656, 26, max)).toBe(630)
    expect(alignTarget(966, 26, max)).toBe(800)
    expect(alignTarget(10, 26, max)).toBe(0)
  })

  it('reads the dominant wheel axis in px', () => {
    expect(wheelDelta({ deltaX: 3, deltaY: -100, deltaMode: 0 }, 900)).toBe(-100)
    expect(wheelDelta({ deltaX: 30, deltaY: 2, deltaMode: 0 }, 900)).toBe(30)
    expect(wheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 }, 900)).toBe(48)
  })
})

/** Feeds [ms since the previous event, delta] pairs; each step's scroll settles `settleMs` later */
function steps(events: [number, number][], settleMs = 500) {
  let wheel: Wheel | undefined
  let now = 0
  let settleAt = Infinity
  const out: number[] = []
  for (const [dt, delta] of events) {
    now += dt
    if (now >= settleAt) {
      wheel = wheelSettled(wheel)
      settleAt = Infinity
    }
    const read = wheelInput(wheel, now, delta)
    wheel = read.wheel
    if (read.dir) {
      out.push(read.dir)
      settleAt = now + settleMs
    }
  }
  return out
}

/** A trackpad swipe at 16 ms a frame: the finger, then a momentum tail losing 5% a frame */
function swipe(sign = 1, frames = Infinity, jitter = 0): [number, number][] {
  const out: [number, number][] = [2, 6, 14, 28, 45, 60].map(d => [16, d * sign])
  let v = 60
  for (let i = 0; v > 0.5 && i < frames; i++) {
    v *= 0.95
    out.push([16, Math.max(1, Math.round(v + (i % 3 === 1 ? jitter : i % 3 === 2 ? -jitter : 0))) * sign])
  }
  return out
}

describe('wheel gestures', () => {
  it('steps once for a fling, however long its momentum tail', () => {
    expect(steps(swipe())).toEqual([1])
    // A real tail wobbles instead of decaying cleanly
    expect(steps(swipe(1, Infinity, 2))).toEqual([1])
  })

  it('steps again for a swipe that starts during the tail', () => {
    expect(steps([...swipe(1, 25), ...swipe(1, 25), ...swipe()])).toEqual([1, 1, 1])
    expect(steps([...swipe(1, 25), ...swipe(-1)])).toEqual([1, -1])
  })

  it('steps once per mouse notch, or per notch burst', () => {
    expect(steps([[0, 100], [300, 100], [300, -100], [1200, 100]])).toEqual([1, 1, -1, 1])
    // Line mode: three lines a notch
    expect(steps([[0, 3 * 16], [300, 3 * 16]])).toEqual([1, 1])
    // Five notches 50 ms apart, then another burst 300 ms later
    const burst: [number, number][] = [[300, 100], [50, 100], [50, 100], [50, 100], [50, 100]]
    expect(steps([...burst, ...burst])).toEqual([1, 1])
  })

  it('keeps stepping, one cell per settled scroll, while a steady stream goes on', () => {
    // A smooth-scrolling or free-spinning wheel: 2 s of 10 px every 16 ms never goes quiet
    const stream = Array.from({ length: 125 }, (): [number, number] => [16, 10])
    expect(steps(stream)).toEqual([1, 1, 1, 1])
  })
})

describe('feedbackTargetOf', () => {
  it('gives the composer the session, image, arrival time, and caption', () => {
    expect(feedbackTargetOf(cell(3, { sessionId: 'od', turnIndex: 1 }))).toEqual({
      sessionId: 'od',
      imageUrl: '/img/3.png',
      at: 3000,
      caption: '2장째',
    })
  })
})
