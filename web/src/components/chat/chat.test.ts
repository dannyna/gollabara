import type { Session, StreamMessage } from '../../../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { answerLabel, choiceLayout, dayLabel, outputLabel, toChoice, toTimeline } from './chat'

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime()
const msg = (id: number, sessionId: string, when: number): StreamMessage => ({ id, at: when, sessionId, sessionName: sessionId, kind: 'turn' })
const session = (id: string, startedAt: number): Session => ({ id, name: `${id} · main`, harness: 'claude-code', cwd: '/', startedAt, lastSeenAt: startedAt })

describe('question choices', () => {
  it('turns a trailing (Recommended) into the 추천 mark', () => {
    expect(toChoice({ label: 'B · 풀블리드 (Recommended)' })).toEqual({ label: 'B · 풀블리드', description: undefined, recommended: true })
    expect(toChoice({ label: 'A' }).recommended).toBe(false)
  })

  it('lays out up to three short labels without descriptions side by side', () => {
    const c = (label: string, description?: string) => toChoice({ label, description })
    expect(choiceLayout([c('A'), c('B'), c('C')])).toBe('short')
    expect(choiceLayout([c('A'), c('B'), c('C'), c('D')])).toBe('rows')
    expect(choiceLayout([c('A', '설명'), c('B')])).toBe('rows')
    expect(choiceLayout([c('아주 긴 선택지 라벨이에요'), c('B')])).toBe('rows')
  })

  it('names picked answers by the label before its description', () => {
    const options = ['A · 좌우 분할', 'B · 풀블리드', 'C'].map(label => toChoice({ label }))
    expect(answerLabel(options, [1])).toBe('B')
    expect(answerLabel(options, [0, 2])).toBe('A, C')
  })
})

describe('outputLabel', () => {
  it('shows the tool without its MCP prefix, or only the count when unknown', () => {
    expect(outputLabel(2, 'mcp__od__screenshot')).toBe('screenshot · 2장')
    expect(outputLabel(3)).toBe('3장')
  })
})

describe('toTimeline', () => {
  it('adds a date line per day and a start line where an in-view session started', () => {
    const now = at(14, 20)
    const items = toTimeline(
      [msg(1, 'a', at(13, 10)), msg(2, 'b', at(14, 9)), msg(3, 'a', at(14, 11))],
      [session('a', at(12, 9)), session('b', at(14, 8)), session('c', at(14, 10))],
      now,
    )
    expect(items.map(i => i.type === 'date' ? i.label : i.key)).toEqual(['어제', 'm-1', '오늘', 'start-b', 'm-2', 'm-3'])
  })

  it('labels older days with the date', () => {
    expect(dayLabel(at(10, 9), at(14, 9))).toContain('10월 10일')
  })
})
