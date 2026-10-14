import type { Artifact } from '../../artifacts'
import { describe, expect, it } from 'bun:test'
import { feedbackTargetOf } from '../overlay/useFeedbackTarget'
import { arrivedSince, atLatest, lastSeq } from './follow'

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
    sessionStart: false,
    seq,
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
    expect(arrivedSince(lastSeq(before), [cell(1), cell(2), cell(3), cell(4), cell(5)])).toBe(1)
    expect(arrivedSince(lastSeq(before), before)).toBe(0)
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
