import type { Session, StreamMessage } from '../../../../src/shared/types'
import type { FeedItem } from './chat'
import { describe, expect, it } from 'bun:test'
import { answerLabel, choiceLayout, dayLabel, outputLabel, sessionMenuItems, START_GROUP_MS, toChoice, toFeed, toTimeline, turnThumbs } from './chat'

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
      [],
      now,
    )
    expect(items.map(i => i.type === 'date' ? i.label : i.key)).toEqual(['어제', 'm-1', '오늘', 'start-b', 'm-2', 'm-3'])
  })

  it('places other system lines at their time, even for sessions out of view', () => {
    const items = toTimeline(
      [msg(1, 'a', at(14, 9)), msg(2, 'a', at(14, 11))],
      [],
      [{ key: 'mute-x', at: at(14, 10), icon: 'mute', text: 'x · main 음소거함' }],
      at(14, 20),
    )
    expect(items.map(i => i.key)).toEqual([expect.stringMatching(/^d-/), 'm-1', 'mute-x', 'm-2'])
  })

  it('places the reader\'s bubbles among the messages by time', () => {
    const mine = { key: 'f-1', at: at(14, 10), sessionId: 'a', text: 'hi', state: 'delivered' as const }
    const items = toTimeline([msg(1, 'a', at(14, 9)), msg(2, 'a', at(14, 11))], [], [], at(14, 20), [mine])
    expect(items.map(i => i.key)).toEqual([expect.stringMatching(/^d-/), 'm-1', 'f-1', 'm-2'])
  })

  it('keeps bubbles and lines outside a run of history out until their messages load', () => {
    const bubble = (key: string, when: number) => ({ key, at: when, sessionId: 'a', text: key, state: 'delivered' as const })
    const mine = [bubble('before', at(10, 8)), bubble('between', at(10, 10)), bubble('today', at(14, 20))]
    const items = toTimeline([msg(1, 'a', at(10, 9)), msg(2, 'a', at(10, 11))], [], [], at(14, 20), mine, { since: at(10, 9), until: at(10, 11) })
    expect(items.map(i => i.key)).toEqual([expect.stringMatching(/^d-/), 'm-1', 'between', 'm-2'])
    expect(items[0]).toMatchObject({ type: 'date', day: new Date(at(10, 9)).setHours(0, 0, 0, 0) })
  })

  it('gives a start its own row type with the session and its full name', () => {
    const items = toTimeline([msg(0, 'x', at(14, 7)), msg(1, 'a', at(14, 9))], [session('a', at(14, 8))], [], at(14, 20))
    expect(items[2]).toEqual({ type: 'start', key: 'start-a', sessionId: 'a', name: 'a · main', at: at(14, 8) })
  })

  it('labels older days with the date', () => {
    expect(dayLabel(at(10, 9), at(14, 9))).toContain('10월 10일')
  })
})

describe('toFeed', () => {
  const min = (m: number) => at(14, 9) + m * 60_000
  const hiddenLine = (m: StreamMessage) => ({ key: `${m.id}:0`, sessionName: m.sessionName, at: m.at, text: `line ${m.id}` })
  const keys = (items: FeedItem[]) => items.map(i => i.type === 'hidden' ? `${i.key}[${i.lines.map(l => l.key).join(',')}]` : i.key)

  it('merges consecutive hidden messages into one row, across sessions', () => {
    const messages = [msg(1, 'a', min(0)), msg(2, 'a', min(1)), msg(3, 'b', min(2)), msg(4, 'a', min(3)), msg(5, 'b', min(4))]
    const hide = new Set([2, 3, 5])
    const feed = toFeed(toTimeline(messages, [], [], min(10)), m => hide.has(m.id) ? [hiddenLine(m)] : null)
    expect(keys(feed).slice(1)).toEqual(['m-1', 'h-2:0[2:0,3:0]', 'm-4', 'h-5:0[5:0]'])
  })

  it('anything drawn between hidden messages splits the row', () => {
    const messages = [msg(1, 'a', min(0)), msg(2, 'b', min(2))]
    const mine = { key: 'f-1', at: min(1), sessionId: 'a', text: 'hi', state: 'delivered' as const }
    const feed = toFeed(toTimeline(messages, [], [], min(10), [mine]), m => [hiddenLine(m)])
    expect(keys(feed).slice(1)).toEqual(['h-1:0[1:0]', 'f-1', 'h-2:0[2:0]'])
  })

  it('folds messages holding only references into 「참고 이미지」 rows, merged until anything else comes between', () => {
    const messages = [msg(1, 'a', min(0)), msg(2, 'b', min(1)), msg(3, 'a', min(2)), msg(4, 'a', min(3))]
    const thumb = (m: StreamMessage) => ({ key: `${m.id}-0`, url: `u${m.id}`, width: 10, height: 10 })
    const refsOnly = new Set([1, 2, 4])
    const feed = toFeed(toTimeline(messages, [], [], min(10)), () => null, m => refsOnly.has(m.id) ? [thumb(m)] : null)
    expect(feed.slice(1).map(i => i.type === 'refs' ? `${i.key}[${i.thumbs.map(t => t.key).join(',')}]` : i.key))
      .toEqual(['r-1-0[1-0,2-0]', 'm-3', 'r-4-0[4-0]'])
  })

  // Starts older than the oldest loaded message get no row, so each case opens with one
  const earlier = msg(0, 'x', min(-1))

  it('groups starts that come together; the next message of one of them leads closer', () => {
    const sessions = [session('a', min(0)), session('b', min(0)), session('c', min(1))]
    const feed = toFeed(toTimeline([earlier, msg(1, 'c', min(2)), msg(2, 'a', min(3)), msg(3, 'b', min(4))], sessions, [], min(10)), () => null)
    expect(feed[2]).toMatchObject({ type: 'starts', lead: true })
    expect(feed[2]?.type === 'starts' && feed[2].rows.map(r => r.sessionId)).toEqual(['a', 'b', 'c'])
  })

  it('keeps starts apart when far apart in time, and leads only into their own message', () => {
    const sessions = [session('a', min(0)), session('b', min(START_GROUP_MS / 60_000 + 1))]
    const feed = toFeed(toTimeline([earlier, msg(1, 'a', min(30)), msg(2, 'b', min(31))], sessions, [], min(40)), () => null)
    expect(feed.slice(2).map(i => i.type === 'starts' ? [i.rows.map(r => r.sessionId), i.lead] : i.key)).toEqual([[['a'], false], [['b'], false], 'm-1', 'm-2'])
    const lone = toFeed(toTimeline([earlier, msg(1, 'b', min(1)), msg(2, 'a', min(2))], [session('a', min(0))], [], min(10)), () => null)
    expect(lone[2]).toMatchObject({ type: 'starts', lead: false })
  })

  it('a start right before a hidden row does not lead', () => {
    const feed = toFeed(toTimeline([earlier, msg(1, 'a', min(1))], [session('a', min(0))], [], min(10)), m => m.id ? [hiddenLine(m)] : null)
    expect(feed.slice(2).map(i => i.type)).toEqual(['starts', 'hidden'])
    expect(feed[2]).toMatchObject({ lead: false })
  })
})

describe('turnThumbs', () => {
  it('splits a turn\'s images by role, keeping each image\'s capture key; no role is an artifact', () => {
    const image = (url: string, role?: 'artifact' | 'reference') => ({ url, width: 10, height: 10, ...(role ? { role } : {}) })
    const m: StreamMessage = { ...msg(7, 'a', 0), images: [image('ref', 'reference'), image('legacy'), image('made', 'artifact')] }
    const { artifacts, references } = turnThumbs(m)
    expect(artifacts.map(t => t.key)).toEqual(['7-1', '7-2'])
    expect(references.map(t => [t.key, t.url])).toEqual([['7-0', 'ref']])
  })
})

describe('sessionMenuItems', () => {
  const labels = (scoped: boolean, muted: boolean) => sessionMenuItems(scoped, muted).map(i => [i.label, i.why ?? null])

  const remove = ['이 세션 데이터 삭제', null]

  it('offers scoping, muting and deleting a session in 「전체 세션」', () => {
    expect(labels(false, false)).toEqual([['이 세션만 보기', null], ['음소거', null], remove])
  })

  it('flips the scope row to 「전체 세션 보기」 while scoped to that session', () => {
    expect(labels(true, false)).toEqual([['전체 세션 보기', null], ['음소거', null], remove])
  })

  it('a muted session offers unmuting and deleting, and cannot become the scope', () => {
    expect(labels(false, true)).toEqual([['이 세션만 보기', '음소거 중'], ['음소거 해제', null], remove])
  })
})
