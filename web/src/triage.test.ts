import type { StreamMessage, Triage } from '../../src/shared/types'
import { describe, expect, test } from 'bun:test'
import { HOLD_MS, newLines, toTriageMap, triageKey, triageView } from './triage'

function turn(id: number, recaps: string[], extra: Partial<StreamMessage> = {}): StreamMessage {
  return { id, at: id * 1000, sessionId: id % 2 ? 'a' : 'b', sessionName: id % 2 ? 'a' : 'b', kind: 'turn', recaps, text: recaps.join('\n'), ...extra }
}
const img = { url: '/img/x.png', width: 10, height: 10 }
const verdict = (messageId: number, v: Triage['verdict'], index = 0): Triage => ({ messageId, index, verdict: v })
const ids = (v: ReturnType<typeof triageView>) => v.items.map(i => i.message.id)

describe('triageView', () => {
  const messages = [turn(1, ['1분 경과']), turn(2, ['e2e 2건 실패']), turn(3, ['2분 경과']), turn(4, ['배포 시작'])]
  const triage = toTriageMap([verdict(1, 'hide'), verdict(2, 'show'), verdict(3, 'hide'), verdict(4, 'hide')])

  test('engine off shows everything as it arrived', () => {
    const v = triageView(messages, { engine: 'off', triage, now: 0 })
    expect(ids(v)).toEqual([1, 2, 3, 4])
    expect(v.hidden).toBe(0)
  })

  test('hidden lines drop out per message across interleaved sessions', () => {
    const v = triageView(messages, { engine: 'claude', triage, now: 0 })
    expect(ids(v)).toEqual([2])
    expect(v.hidden).toBe(3)
  })

  test('the toggle reveals hidden lines inline, dimmed', () => {
    const v = triageView(messages, { engine: 'claude', triage, now: 0, showHidden: true })
    expect(ids(v)).toEqual([1, 2, 3, 4])
    expect(v.items.map(i => i.dim)).toEqual([true, false, true, true])
    expect(v.hidden).toBe(3)
  })

  test('turns with images and questions are never hidden', () => {
    const withImage = turn(5, ['5분 경과'], { images: [img] })
    const question: StreamMessage = { id: 6, at: 6, sessionId: 'a', sessionName: 'a', kind: 'question', questions: [{ question: '어느 쪽?', options: [] }] }
    const v = triageView([withImage, question], { engine: 'claude', triage: toTriageMap([verdict(5, 'hide'), verdict(6, 'hide')]), now: 0 })
    expect(ids(v)).toEqual([5, 6])
    expect(v.hidden).toBe(0)
  })

  test('only the hidden line of a mixed turn drops out', () => {
    const v = triageView([turn(7, ['빌드 끝', '1분 경과'])], { engine: 'claude', triage: toTriageMap([verdict(7, 'show', 0), verdict(7, 'hide', 1)]), now: 0 })
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

  test('the hold covers a slow model verdict (10 s) and never applies to images or questions', () => {
    expect(HOLD_MS).toBe(10_000)
    const arrivals = new Map([[triageKey(9, 0), 0], [triageKey(10, 0), 0], [triageKey(11, 0), 0]])
    const question: StreamMessage = { id: 11, at: 11, sessionId: 'a', sessionName: 'a', kind: 'question', questions: [{ question: '어느 쪽?', options: [] }] }
    const v = triageView([turn(9, ['테스트 중']), turn(10, ['캡처'], { images: [img] }), question], { engine: 'claude', triage: new Map(), arrivals, now: 9_000 })
    expect(ids(v)).toEqual([10, 11])
  })
})

describe('newLines', () => {
  test('a new message brings all its lines; an upsert only the added ones', () => {
    expect(newLines(undefined, turn(1, ['a']))).toEqual(['1:0'])
    expect(newLines(turn(1, ['a']), turn(1, ['a', 'b']))).toEqual(['1:1'])
    expect(newLines(turn(1, ['a']), turn(1, ['a'], { images: [img] }))).toEqual([])
  })
})
