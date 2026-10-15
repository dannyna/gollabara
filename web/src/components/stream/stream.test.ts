import type { Artifact } from '../../artifacts'
import { describe, expect, it } from 'bun:test'
import { feedbackTargetOf } from '../overlay/useFeedbackTarget'
import { arrivedSince, atLatest, lastArrival } from './follow'
import { alignTarget, stepTarget, wheelDelta } from './step'

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

  it('counts arrivals only, not cells that reappear after an unmute', () => {
    const before = [cell(1), cell(4)]
    // Unmuted cells 2 and 3 are older than what was seen; 5 is new
    expect(arrivedSince(lastArrival(before), [cell(1), cell(2), cell(3), cell(4), cell(5)])).toBe(1)
    expect(arrivedSince(lastArrival(before), before)).toBe(0)
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
