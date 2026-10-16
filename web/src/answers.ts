// Answering a session's own question from the app (opt-in, Claude Code only). The card is answerable only
// while the session's `ask` hook holds the question; everything here is pure, except postAnswer.

import type { AnswerRequest, Question, QuestionAnswer, QuestionHold, ServerFrame, Session, StreamMessage } from '../../src/shared/types'
import type { QuestionState } from './components/chat/QuestionCard.vue'
import { answerLabel, toChoice } from './components/chat/chat'

/** Open holds by questionId */
export type Holds = ReadonlyMap<string, QuestionHold>

/** The holds a hello frame carries; older servers send none */
export function holdsFrom(list: QuestionHold[] = []): Map<string, QuestionHold> {
  return new Map(list.map(h => [h.questionId, h]))
}

/** A hold frame starts a hold (`until`) or ends it (`until: null`); a hold may start before its question arrives */
export function applyHold(holds: Holds, frame: Extract<ServerFrame, { type: 'hold' }>): Map<string, QuestionHold> {
  const next = new Map(holds)
  if (frame.until == null)
    next.delete(frame.questionId)
  else
    next.set(frame.questionId, { sessionId: frame.sessionId, questionId: frame.questionId, until: frame.until })
  return next
}

/** The question's hold, while it has time left */
export function liveHold(message: StreamMessage, holds: Holds, now: number): QuestionHold | undefined {
  const hold = message.questionId ? holds.get(message.questionId) : undefined
  return hold && hold.sessionId === message.sessionId && hold.until > now ? hold : undefined
}

/**
 * Whether the app may answer the question now: its hook holds it, the app is connected, and the session is a
 * live Claude Code one. A session with no record yet trusts the hold, which the server only grants to
 * Claude Code sessions it has not seen end.
 */
export function canAnswer(message: StreamMessage, session: Session | undefined, holds: Holds, connected: boolean, now: number): boolean {
  if (!message.questionId || !connected || message.answer || !liveHold(message, holds, now))
    return false
  return !session || (!session.endedAt && session.harness === 'claude-code')
}

/** The answer Claude Code expects: the picked raw labels (「(Recommended)」 kept), joined with ", " */
export function rawAnswer(question: Question, picks: number[]): string {
  return [...picks].sort((a, b) => a - b).map(i => question.options[i]?.label).filter(Boolean).join(', ')
}

/**
 * Maps an answer back to option indexes. A multiSelect answer is split on ", ", greedily, since a label can
 * hold ", " itself. An answer, or any part of one, that matches no label is free text.
 */
export function answerPicks(question: Question, answer: string): { picks: number[], text?: string } {
  const labels = question.options.map(o => [o.label, toChoice(o).label])
  const find = (s: string) => labels.findIndex(l => l.includes(s.trim()))
  const whole = find(answer)
  if (whole !== -1)
    return { picks: [whole] }
  if (!question.multiSelect)
    return { picks: [], text: answer }
  const parts = answer.split(', ')
  const picks: number[] = []
  for (let i = 0; i < parts.length;) {
    let j = parts.length
    let hit = -1
    for (; j > i && hit === -1; j--)
      hit = find(parts.slice(i, j).join(', '))
    if (hit === -1)
      return { picks: [], text: answer }
    picks.push(hit)
    i = j + 1
  }
  return { picks }
}

/** What follows 「…로 답했어요」: picked labels before their ` · ` description, or the free text */
export function answerText(question: Question, answer: string): string {
  const { picks, text } = answerPicks(question, answer)
  return text ?? answerLabel(question.options.map(toChoice), picks)
}

/** One question's answer in progress in a question set: picked options, or typed text in 「직접 답하기」 */
export interface Draft {
  picks: number[]
  /** Set while 「직접 답하기」 is open; the typed text answers instead of the picks */
  text?: string
}

/** The answers a set of drafts makes, keyed by question text, and whether every question has one */
export function draftAnswers(questions: Question[], drafts: Draft[]): { answers: Record<string, string>, answered: boolean[], complete: boolean } {
  const answers: Record<string, string> = {}
  const answered = questions.map((q, i) => {
    const d = drafts[i]
    const value = d?.text != null ? d.text.trim() : rawAnswer(q, d?.picks ?? [])
    if (value)
      answers[q.question] = value
    return !!value
  })
  return { answers, answered, complete: answered.every(Boolean) }
}

/** The app's own send of an answer, until the server's record replaces it */
export interface LocalAnswer {
  status: 'sending' | 'sent' | AnswerFailure
  answers: Record<string, string>
  at: number
}

export type AnswerFailure = 'closed' | 'refused' | 'invalid' | 'network'

/** What a question card draws, from the stored answer, the app's send, the hold and the connection */
export interface QuestionView {
  state: QuestionState
  /** Drawn but not answerable */
  inert: boolean
  /** Picked option indexes per question */
  picks: number[][]
  /** Free-text answers per question, where the answer is no label */
  texts: (string | undefined)[]
  /** The hold's end, for the countdown */
  until?: number
  answeredAt?: number
  /** In the fail state: why, and whether 「다시 보내기」 can go */
  failure?: AnswerFailure
  retry?: boolean
}

function mapAnswers(questions: Question[], answers: Record<string, string>) {
  const mapped = questions.map(q => answers[q.question] == null ? { picks: [] } : answerPicks(q, answers[q.question]!))
  return { picks: mapped.map(m => m.picks), texts: mapped.map(m => m.text) }
}

/**
 * The card's state. The stored answer wins (terminal or app), then the app's own send, then a live hold;
 * anything else is read-only, as before answering existed. The offline line promises an answer only while
 * the hold still has time.
 */
export function questionView(input: { message: StreamMessage, session?: Session, holds: Holds, connected: boolean, now: number, local?: LocalAnswer }): QuestionView {
  const { message, session, holds, connected, now, local } = input
  const questions = message.questions ?? []
  const stored: QuestionAnswer | undefined = message.answer
  if (stored)
    return { state: stored.via === 'app' ? 'done' : 'terminal', inert: true, ...mapAnswers(questions, stored.answers), answeredAt: stored.at }
  const open = canAnswer(message, session, holds, connected, now)
  const until = open ? liveHold(message, holds, now)?.until : undefined
  if (local) {
    const mapped = mapAnswers(questions, local.answers)
    if (local.status === 'sending')
      return { state: 'sending', inert: true, ...mapped }
    if (local.status === 'sent')
      return { state: 'done', inert: true, ...mapped, answeredAt: local.at }
    const retry = local.status === 'network' && open
    return { state: 'fail', inert: !retry, ...mapped, failure: local.status, retry, until: retry ? until : undefined }
  }
  const blank = { picks: questions.map(() => []), texts: questions.map(() => undefined) }
  if (!connected)
    return { state: 'offline', inert: !liveHold(message, holds, now), ...blank }
  if (open)
    return { state: 'open', inert: false, ...blank, until }
  return { state: 'open', inert: true, ...blank }
}

/** The muted countdown under a held card: 「52초 안에 답하면 바로 전달돼요」 */
export function holdNote(until: number, now: number): string {
  return `${Math.max(0, Math.ceil((until - now) / 1000))}초 안에 답하면 바로 전달돼요`
}

/** The fail line's copy */
export const FAILURE_NOTE: Record<AnswerFailure, string> = {
  closed: '시간이 지나 터미널로 넘어갔어요',
  refused: '이 Mac이나 tailnet에서만 답할 수 있어요',
  invalid: '답을 보내지 못했어요',
  network: '전달하지 못했어요',
}

/** POST /api/questions/answer; never throws */
export async function postAnswer(request: AnswerRequest, fetcher: typeof fetch = fetch): Promise<'ok' | AnswerFailure> {
  let res: Response
  try {
    res = await fetcher('/api/questions/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) })
  }
  catch {
    return 'network'
  }
  if (res.ok)
    return 'ok'
  if (res.status === 409)
    return 'closed'
  if (res.status === 403)
    return 'refused'
  if (res.status === 400)
    return 'invalid'
  return 'network'
}
