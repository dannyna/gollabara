import type { Question, QuestionHold, Session, StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { answerPicks, answerText, applyHold, canAnswer, draftAnswers, holdNote, holdsFrom, postAnswer, questionView, rawAnswer } from './answers'

const NOW = 1_000_000
const ROWS: Question = {
  header: '히어로',
  question: '어느 쪽으로 갈까요?',
  options: [{ label: 'A · 좌우 분할' }, { label: 'B (Recommended)' }, { label: 'C' }],
}
const MULTI: Question = {
  header: '범위',
  question: '어떤 화면을 볼까요?',
  multiSelect: true,
  options: [{ label: '결제' }, { label: '장바구니, 쿠폰' }, { label: '주문 완료' }],
}
function message(extra: Partial<StreamMessage> = {}): StreamMessage {
  return {
    id: 1,
    at: NOW,
    sessionId: 's1',
    sessionName: 'od',
    kind: 'question',
    questions: [ROWS],
    questionId: 'toolu_1',
    ...extra,
  }
}
const session = (extra: Partial<Session> = {}): Session => ({ id: 's1', name: 'od', harness: 'claude-code', cwd: '/', startedAt: 0, lastSeenAt: 0, ...extra })
const hold: QuestionHold = { sessionId: 's1', questionId: 'toolu_1', until: NOW + 30_000 }
const held = holdsFrom([hold])

describe('holds', () => {
  it('starts and ends a hold by questionId, whether or not its question arrived yet', () => {
    const started = applyHold(new Map(), { type: 'hold', sessionId: 's1', questionId: 'toolu_9', until: NOW })
    expect(started.get('toolu_9')).toEqual({ sessionId: 's1', questionId: 'toolu_9', until: NOW })
    expect(applyHold(started, { type: 'hold', sessionId: 's1', questionId: 'toolu_9', until: null }).size).toBe(0)
    expect(holdsFrom().size).toBe(0)
  })

  it('answers only a held, unanswered question of a live Claude Code session while connected', () => {
    expect(canAnswer(message(), session(), held, true, NOW)).toBe(true)
    expect(canAnswer(message(), session(), held, false, NOW)).toBe(false)
    expect(canAnswer(message(), session(), held, true, hold.until)).toBe(false)
    expect(canAnswer(message(), session(), new Map(), true, NOW)).toBe(false)
    expect(canAnswer(message({ questionId: undefined }), session(), held, true, NOW)).toBe(false)
    expect(canAnswer(message({ sessionId: 's2' }), session({ id: 's2' }), held, true, NOW)).toBe(false)
    expect(canAnswer(message(), session({ harness: 'codex' }), held, true, NOW)).toBe(false)
    expect(canAnswer(message(), session({ endedAt: NOW }), held, true, NOW)).toBe(false)
    expect(canAnswer(message({ answer: { answers: {}, via: 'terminal', at: NOW } }), session(), held, true, NOW)).toBe(false)
    // No record yet: the server granted the hold, so it is trusted
    expect(canAnswer(message(), undefined, held, true, NOW)).toBe(true)
  })
})

describe('answers', () => {
  it('sends raw labels, the (Recommended) suffix kept, multiSelect joined with ", " in option order', () => {
    expect(rawAnswer(ROWS, [1])).toBe('B (Recommended)')
    expect(rawAnswer(MULTI, [2, 0])).toBe('결제, 주문 완료')
  })

  it('maps an answer back to option indexes, or keeps it as free text', () => {
    expect(answerPicks(ROWS, 'B (Recommended)')).toEqual({ picks: [1] })
    expect(answerPicks(ROWS, 'B')).toEqual({ picks: [1] })
    expect(answerPicks(ROWS, 'B로 가되 카피는 짧게')).toEqual({ picks: [], text: 'B로 가되 카피는 짧게' })
    expect(answerPicks(MULTI, '결제, 주문 완료')).toEqual({ picks: [0, 2] })
    // A label that holds ", " itself
    expect(answerPicks(MULTI, '장바구니, 쿠폰, 결제')).toEqual({ picks: [1, 0] })
    expect(answerPicks(MULTI, '결제, 다른 화면')).toEqual({ picks: [], text: '결제, 다른 화면' })
    expect(answerText(ROWS, 'A · 좌우 분할')).toBe('A')
    expect(answerText(ROWS, '둘 다')).toBe('둘 다')
  })

  it('assembles a set of drafts keyed by question text, complete only when each has an answer', () => {
    expect(draftAnswers([ROWS, MULTI], [{ picks: [1] }, { picks: [] }])).toEqual({
      answers: { [ROWS.question]: 'B (Recommended)' },
      answered: [true, false],
      complete: false,
    })
    const typed = draftAnswers([ROWS, MULTI], [{ picks: [0], text: '  직접 쓴 답 ' }, { picks: [0, 1] }])
    expect(typed.answers).toEqual({ [ROWS.question]: '직접 쓴 답', [MULTI.question]: '결제, 장바구니, 쿠폰' })
    expect(typed.complete).toBe(true)
    // An open but empty 「직접 답하기」 is no answer, whatever was picked before
    expect(draftAnswers([ROWS], [{ picks: [0], text: ' ' }]).complete).toBe(false)
  })

  it('counts the hold down in whole seconds, never below zero', () => {
    expect(holdNote(NOW + 51_200, NOW)).toBe('52초 안에 답하면 바로 전달돼요')
    expect(holdNote(NOW - 5, NOW)).toBe('0초 안에 답하면 바로 전달돼요')
  })
})

describe('question card state', () => {
  const base = { message: message(), session: session(), holds: held, connected: true, now: NOW }

  it('opens a held question with its countdown, and keeps any other read-only', () => {
    expect(questionView(base)).toMatchObject({ state: 'open', inert: false, until: hold.until })
    expect(questionView({ ...base, holds: new Map() })).toMatchObject({ state: 'open', inert: true })
    expect(questionView({ ...base, holds: new Map() }).until).toBeUndefined()
    expect(questionView({ ...base, session: session({ harness: 'codex' }) })).toMatchObject({ state: 'open', inert: true })
  })

  it('shows the stored answer first: terminal, or done from the app, with picks or free text', () => {
    const terminal = questionView({ ...base, message: message({ answer: { answers: { [ROWS.question]: 'C' }, via: 'terminal', at: 5 } }) })
    expect(terminal).toMatchObject({ state: 'terminal', inert: true, picks: [[2]], texts: [undefined], answeredAt: 5 })
    const app = questionView({ ...base, message: message({ answer: { answers: { [ROWS.question]: '둘 다' }, via: 'app', at: 6 } }), local: { status: 'sending', answers: {}, at: 1 } })
    expect(app).toMatchObject({ state: 'done', picks: [[]], texts: ['둘 다'] })
  })

  it('follows the app\'s own send until the server records it, even after the hold ends', () => {
    const answers = { [ROWS.question]: 'B (Recommended)' }
    expect(questionView({ ...base, local: { status: 'sending', answers, at: 1 } })).toMatchObject({ state: 'sending', inert: true, picks: [[1]] })
    expect(questionView({ ...base, holds: new Map(), local: { status: 'sent', answers, at: 7 } })).toMatchObject({ state: 'done', answeredAt: 7 })
    expect(questionView({ ...base, local: { status: 'closed', answers, at: 1 } })).toMatchObject({ state: 'fail', failure: 'closed', retry: false, inert: true })
    expect(questionView({ ...base, local: { status: 'network', answers, at: 1 } })).toMatchObject({ state: 'fail', retry: true, inert: false, until: hold.until })
    expect(questionView({ ...base, holds: new Map(), local: { status: 'network', answers, at: 1 } })).toMatchObject({ state: 'fail', retry: false, inert: true })
  })

  it('offline, promises an answer after reconnecting only while the hold has time', () => {
    expect(questionView({ ...base, connected: false })).toMatchObject({ state: 'offline', inert: false })
    expect(questionView({ ...base, connected: false, now: hold.until })).toMatchObject({ state: 'offline', inert: true })
  })
})

describe('postAnswer', () => {
  const request = { sessionId: 's1', questionId: 'toolu_1', answers: { [ROWS.question]: 'C' } }
  const reply = (status: number) => (async () => new Response('{}', { status })) as unknown as typeof fetch

  it('posts the answers as JSON', async () => {
    let sent: [string, RequestInit] | undefined
    const fetcher = (async (url: string, init: RequestInit) => {
      sent = [url, init]
      return Response.json({ ok: true })
    }) as unknown as typeof fetch
    expect(await postAnswer(request, fetcher)).toBe('ok')
    expect(sent?.[0]).toBe('/api/questions/answer')
    expect(sent?.[1].method).toBe('POST')
    expect(JSON.parse(String(sent?.[1].body))).toEqual(request)
  })

  it('names each failure: closed hold, untrusted source, bad input, anything else as network', async () => {
    expect(await postAnswer(request, reply(409))).toBe('closed')
    expect(await postAnswer(request, reply(403))).toBe('refused')
    expect(await postAnswer(request, reply(400))).toBe('invalid')
    expect(await postAnswer(request, reply(502))).toBe('network')
    expect(await postAnswer(request, (async () => {
      throw new TypeError('offline')
    }) as unknown as typeof fetch)).toBe('network')
  })
})
