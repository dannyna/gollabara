import type { StreamMessage, Tone, Triage } from '../../src/shared/types'
import type { MessageView, TriageView } from './triage'
import { describe, expect, test } from 'bun:test'
import { HOLD_MS, newLines, shownKeys, toTriageMap, triageKey, triageView } from './triage'

function turn(id: number, recaps: string[], extra: Partial<StreamMessage> = {}): StreamMessage {
  return { id, at: id * 1000, sessionId: id % 2 ? 'a' : 'b', sessionName: id % 2 ? 'a' : 'b', kind: 'turn', recaps, text: recaps.join('\n'), ...extra }
}
const img = { url: '/img/x.png', width: 10, height: 10 }
const verdict = (messageId: number, v: Triage['verdict'], index = 0, tone?: Tone): Triage => ({ messageId, index, verdict: v, ...(tone ? { tone } : {}) })
const ids = (v: TriageView) => v.items.filter(i => !i.folded).map(i => i.message.id)
const folded = (v: TriageView) => v.items.filter(i => i.folded).map(i => i.message.id)
const lines = (i: MessageView) => i.parts.flatMap(p => p.type === 'line' ? [p.line] : [])

describe('triageView', () => {
  const messages = [turn(1, ['1분 경과']), turn(2, ['e2e 2건 실패']), turn(3, ['2분 경과']), turn(4, ['배포 시작'])]
  const triage = toTriageMap([verdict(1, 'hide'), verdict(2, 'show'), verdict(3, 'hide'), verdict(4, 'hide')])

  test('engine off shows everything as it arrived, in the default state', () => {
    const v = triageView(messages, { engine: 'off', triage: toTriageMap([verdict(2, 'show', 0, 'danger')]), now: 0 })
    expect(ids(v)).toEqual([1, 2, 3, 4])
    expect(v.items.flatMap(lines).map(l => l.tone)).toEqual(['default', 'default', 'default', 'default'])
    expect(v.hidden).toBe(0)
  })

  test('hidden messages fold in place across interleaved sessions', () => {
    const v = triageView(messages, { engine: 'claude', triage, now: 0 })
    expect(ids(v)).toEqual([2])
    expect(folded(v)).toEqual([1, 3, 4])
    expect(v.items.map(i => i.message.id)).toEqual([1, 2, 3, 4])
    expect(v.hidden).toBe(3)
  })

  test('turns with images and questions are never hidden', () => {
    const withImage = turn(5, ['5분 경과'], { images: [img] })
    const question: StreamMessage = { id: 6, at: 6, sessionId: 'a', sessionName: 'a', kind: 'question', questions: [{ question: '어느 쪽?', options: [] }] }
    const v = triageView([withImage, question], { engine: 'claude', triage: toTriageMap([verdict(5, 'hide'), verdict(6, 'hide')]), now: 0 })
    expect(ids(v)).toEqual([5, 6])
    expect(v.hidden).toBe(0)
  })

  test('hidden lines inside a turn fold into one row in place', () => {
    const v = triageView([turn(7, ['빌드 끝', '1분 경과', '2분 경과', '배포 끝'])], {
      engine: 'claude',
      triage: toTriageMap([verdict(7, 'show', 0), verdict(7, 'hide', 1), verdict(7, 'hide', 2), verdict(7, 'show', 3)]),
      now: 0,
    })
    expect(v.items[0]!.parts.map(p => p.type === 'line' ? p.line.text : p.lines.map(l => l.text))).toEqual(['빌드 끝', ['1분 경과', '2분 경과'], '배포 끝'])
    expect(v.items[0]!.folded).toBe(false)
    expect(v.hidden).toBe(2)
  })

  test('a new recap-only line waits for its verdict, then shows anyway', () => {
    const arrivals = new Map([[triageKey(9, 0), 10_000]])
    const waiting = triageView([turn(9, ['테스트 중'])], { engine: 'claude', triage: new Map(), arrivals, now: 10_500 })
    expect(waiting.items).toEqual([])
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

describe('line states', () => {
  test('a shown line takes its tone; an old verdict without one reads as default', () => {
    const v = triageView([turn(1, ['배포 끝', '확인 필요', '설명'])], {
      engine: 'claude',
      triage: toTriageMap([verdict(1, 'show', 0, 'success'), verdict(1, 'show', 1, 'warning'), verdict(1, 'show', 2)]),
      now: 0,
    })
    expect(lines(v.items[0]!).map(l => l.tone)).toEqual(['success', 'warning', 'default'])
  })

  test('only the session\'s latest stated line is filled; earlier ones keep only their icon', () => {
    // a: danger → default → success; b: warning, interleaved
    const feed = [turn(1, ['e2e 2건 실패']), turn(2, ['마이그레이션 확인해 줘']), turn(3, ['라벨 줄임']), turn(5, ['e2e 12건 통과'])]
    const v = triageView(feed, {
      engine: 'claude',
      triage: toTriageMap([verdict(1, 'show', 0, 'danger'), verdict(2, 'show', 0, 'warning'), verdict(3, 'show', 0, 'default'), verdict(5, 'show', 0, 'success')]),
      now: 0,
    })
    expect(v.items.flatMap(lines).map(l => [l.tone, l.filled])).toEqual([
      ['danger', false],
      ['warning', true],
      ['default', false],
      ['success', true],
    ])
  })

  test('a default line does not clear an earlier state', () => {
    const v = triageView([turn(1, ['e2e 2건 실패']), turn(3, ['다시 돌리는 중'])], {
      engine: 'claude',
      triage: toTriageMap([verdict(1, 'show', 0, 'danger'), verdict(3, 'show', 0)]),
      now: 0,
    })
    expect(v.items.flatMap(lines).map(l => l.filled)).toEqual([true, false])
  })

  test('within one turn the last stated line is the filled one', () => {
    const v = triageView([turn(1, ['리필 배치 끝', '마이그레이션 봐 줘', '테스트 통과'])], {
      engine: 'claude',
      triage: toTriageMap([verdict(1, 'show', 0), verdict(1, 'show', 1, 'warning'), verdict(1, 'show', 2, 'success')]),
      now: 0,
    })
    expect(lines(v.items[0]!).map(l => [l.tone, l.filled])).toEqual([['default', false], ['warning', false], ['success', true]])
  })

  test('a line in a turn with images keeps its tone, and a hide there reads as default', () => {
    const v = triageView([turn(1, ['비교 2장'], { images: [img] }), turn(3, ['1분 경과'], { images: [img] })], {
      engine: 'claude',
      triage: toTriageMap([verdict(1, 'show', 0, 'success'), verdict(3, 'hide')]),
      now: 0,
    })
    expect(v.items.flatMap(lines).map(l => [l.tone, l.filled])).toEqual([['success', true], ['default', false]])
  })
})

describe('late hide verdicts', () => {
  test('a line already shown dims in place instead of folding', () => {
    const feed = [turn(1, ['단축키 연결하는 중'])]
    const before = triageView(feed, { engine: 'claude', triage: new Map(), now: 0 })
    const seen = new Set(shownKeys(before))
    expect(seen).toEqual(new Set(['1:0']))

    const after = triageView(feed, { engine: 'claude', triage: toTriageMap([verdict(1, 'hide')]), now: 0, seen })
    expect(ids(after)).toEqual([1])
    expect(lines(after.items[0]!)).toEqual([{ index: 0, text: '단축키 연결하는 중', tone: 'default', filled: false, weak: true }])
    expect(after.hidden).toBe(0)
    // A dimmed line is not counted as shown again, and a fresh view (a reload) folds it
    expect(shownKeys(after)).toEqual([])
    expect(folded(triageView(feed, { engine: 'claude', triage: toTriageMap([verdict(1, 'hide')]), now: 0 }))).toEqual([1])
  })

  test('a held line whose hide comes within the hold was never shown, so it folds', () => {
    const arrivals = new Map([[triageKey(1, 0), 0]])
    const held = triageView([turn(1, ['1분 경과'])], { engine: 'claude', triage: new Map(), arrivals, now: 1_000 })
    const seen = new Set(shownKeys(held))
    expect(seen.size).toBe(0)
    expect(folded(triageView([turn(1, ['1분 경과'])], { engine: 'claude', triage: toTriageMap([verdict(1, 'hide')]), arrivals, now: 4_000, seen }))).toEqual([1])
  })
})

describe('newLines', () => {
  test('a new message brings all its lines; an upsert only the added ones', () => {
    expect(newLines(undefined, turn(1, ['a']))).toEqual(['1:0'])
    expect(newLines(turn(1, ['a']), turn(1, ['a', 'b']))).toEqual(['1:1'])
    expect(newLines(turn(1, ['a']), turn(1, ['a'], { images: [img] }))).toEqual([])
  })
})
