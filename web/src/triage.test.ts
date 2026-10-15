import type { StreamMessage, Triage } from '../../src/shared/types'
import { describe, expect, test } from 'bun:test'
import { HOLD_MS, newLines, toTriageMap, triageKey, triageView } from './triage'

function turn(id: number, recaps: string[], extra: Partial<StreamMessage> = {}): StreamMessage {
  return { id, at: id * 1000, sessionId: id % 2 ? 'a' : 'b', sessionName: id % 2 ? 'a' : 'b', kind: 'turn', recaps, text: recaps.join('\n'), ...extra }
}
const img = { url: '/img/x.png', width: 10, height: 10 }
const verdict = (messageId: number, v: Triage['verdict'], index = 0, more: Partial<Triage> = {}): Triage => ({ messageId, index, verdict: v, ...more })
const ids = (v: ReturnType<typeof triageView>) => v.items.map(i => i.message.id)

describe('triageView', () => {
  const messages = [turn(1, ['1분 경과']), turn(2, ['e2e 2건 실패']), turn(3, ['2분 경과']), turn(4, ['배포 완료'])]
  const triage = toTriageMap([verdict(1, 'noise'), verdict(2, 'signal', 0, { advice: '로그부터', draft: '로그 보여 줘' }), verdict(3, 'noise'), verdict(4, 'progress')])

  test('engine off shows everything as it arrived, with no advice', () => {
    const v = triageView(messages, { engine: 'off', triage, now: 0 })
    expect(ids(v)).toEqual([1, 2, 3, 4])
    expect(v.hidden).toBe(0)
    expect(v.items[1]!.lines[0]!.advice).toBeUndefined()
  })

  test('noise drops out per message across interleaved sessions; the rest keep advice', () => {
    const v = triageView(messages, { engine: 'claude', triage, now: 0 })
    expect(ids(v)).toEqual([2, 4])
    expect(v.hidden).toBe(2)
    expect(v.items[0]!.lines[0]).toMatchObject({ advice: '로그부터', draft: '로그 보여 줘' })
  })

  test('the toggle reveals noise inline, dimmed', () => {
    const v = triageView(messages, { engine: 'claude', triage, now: 0, showHidden: true })
    expect(ids(v)).toEqual([1, 2, 3, 4])
    expect(v.items.map(i => i.dim)).toEqual([true, false, true, false])
    expect(v.hidden).toBe(2)
  })

  test('turns with images and questions are never hidden', () => {
    const withImage = turn(5, ['5분 경과'], { images: [img] })
    const question: StreamMessage = { id: 6, at: 6, sessionId: 'a', sessionName: 'a', kind: 'question', questions: [{ question: '어느 쪽?', options: [] }] }
    const v = triageView([withImage, question], {
      engine: 'claude',
      triage: toTriageMap([verdict(5, 'noise'), verdict(6, 'signal', 0, { advice: 'B가 안전해요', draft: 'B로 가자' })]),
      now: 0,
    })
    expect(ids(v)).toEqual([5, 6])
    expect(v.hidden).toBe(0)
    expect(v.items[1]).toMatchObject({ advice: 'B가 안전해요', draft: 'B로 가자' })
  })

  test('only the noise line of a mixed turn is hidden', () => {
    const v = triageView([turn(7, ['빌드 끝', '1분 경과'])], { engine: 'claude', triage: toTriageMap([verdict(7, 'progress', 0), verdict(7, 'noise', 1)]), now: 0 })
    expect(v.items[0]!.lines.map(l => l.text)).toEqual(['빌드 끝'])
    expect(v.hidden).toBe(1)
  })

  test('a new recap-only line waits for its verdict, then shows anyway', () => {
    const arrivals = new Map([[triageKey(9, 0), 10_000]])
    const waiting = triageView([turn(9, ['테스트 중'])], { engine: 'claude', triage: new Map(), arrivals, now: 10_500 })
    expect(ids(waiting)).toEqual([])
    expect(waiting.nextCheck).toBe(10_000 + HOLD_MS)
    expect(ids(triageView([turn(9, ['테스트 중'])], { engine: 'claude', triage: new Map(), arrivals, now: 10_000 + HOLD_MS }))).toEqual([9])
    // Lines from the first hello have no arrival time and never wait
    expect(ids(triageView([turn(9, ['테스트 중'])], { engine: 'claude', triage: new Map(), now: 10_500 }))).toEqual([9])
  })
})

describe('newLines', () => {
  test('a new message brings all its lines; an upsert only the added ones', () => {
    expect(newLines(undefined, turn(1, ['a']))).toEqual(['1:0'])
    expect(newLines(turn(1, ['a']), turn(1, ['a', 'b']))).toEqual(['1:1'])
    expect(newLines(turn(1, ['a']), turn(1, ['a'], { images: [img] }))).toEqual([])
  })
})
