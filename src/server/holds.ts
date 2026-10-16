// Questions a session's `ask` hook holds open so the app can answer them (opt-in, Claude Code only). In memory
// only: a hold lives as long as the hook's request, at most ANSWER_HOLD_MS, and a restart drops the request too.
import type { Question, QuestionHold } from '../shared/types'
import { ANSWER_HOLD_MS, ANSWER_MAX } from '../shared/answer'

interface Live {
  hold: QuestionHold
  /** The held question texts, the keys an answer must name */
  texts: Set<string>
  settle: (answers: Record<string, string> | null) => void
}

/** What an answer to a hold came to: taken (the hook got it), the hold is gone, or the answers don't fit */
export type AnswerResult
  = | { status: 'ok', answers: Record<string, string> }
    | { status: 'closed' }
    | { status: 'invalid', error: string }

export class Holds {
  private live = new Map<string, Live>()

  /** `onChange` hears every hold start (with its `until`) and every end (null), once each */
  constructor(
    private readonly onChange: (hold: QuestionHold, live: boolean) => void,
    private readonly holdMs = ANSWER_HOLD_MS,
    private readonly now = Date.now,
  ) {}

  /** The holds open now, for the hello frame */
  active(): QuestionHold[] {
    return [...this.live.values()].map(l => l.hold)
  }

  /**
   * Holds the question until it is answered (the answers), the hold runs out, or `signal` aborts (null: the
   * hook gave up, e.g. Esc in the terminal). A question already held is not held twice: null at once.
   */
  hold(sessionId: string, questionId: string, questions: Question[], signal: AbortSignal): Promise<Record<string, string> | null> {
    if (this.live.has(questionId) || signal.aborted)
      return Promise.resolve(null)
    return new Promise((resolve) => {
      const hold: QuestionHold = { sessionId, questionId, until: this.now() + this.holdMs }
      let timer: ReturnType<typeof setTimeout> | undefined
      const settle = (answers: Record<string, string> | null) => {
        if (this.live.get(questionId)?.settle !== settle)
          return
        this.live.delete(questionId)
        clearTimeout(timer)
        this.onChange(hold, false)
        resolve(answers)
      }
      timer = setTimeout(settle, this.holdMs, null)
      // The request's own signal: it goes with the request, so the listener needs no removing
      signal.addEventListener('abort', () => settle(null), { once: true })
      this.live.set(questionId, { hold, texts: new Set(questions.map(q => q.question)), settle })
      this.onChange(hold, true)
    })
  }

  /**
   * The app's answer to a held question. Every held question needs a non-empty answer (trimmed, at most
   * ANSWER_MAX characters) and no other key; a taken answer ends the hold and goes to the hook.
   */
  answer(sessionId: string, questionId: string, raw: unknown): AnswerResult {
    const live = this.live.get(questionId)
    if (!live || live.hold.sessionId !== sessionId)
      return { status: 'closed' }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return { status: 'invalid', error: 'answers must be an object' }
    const answers: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (!live.texts.has(key))
        return { status: 'invalid', error: 'answers name a question that was not asked' }
      const text = typeof value === 'string' ? value.trim() : ''
      if (!text || text.length > ANSWER_MAX)
        return { status: 'invalid', error: `each answer must be text of 1 to ${ANSWER_MAX} characters` }
      answers[key] = text
    }
    if (Object.keys(answers).length !== live.texts.size)
      return { status: 'invalid', error: 'every question needs an answer' }
    live.settle(answers)
    return { status: 'ok', answers }
  }
}
