// Triage for session chat (#32, #37). When the user opts in, a CLI on this machine reads each
// new recap line in the background and decides only whether it is shown. Only chat text is
// read, never images. Results are shown to the user only; nothing is ever sent to a session.
// Questions are always shown, so they are never judged; they appear only as context.

import type { IncomingEvent, Question, StreamMessage, Triage, TriageEngine, Verdict } from '../shared/types'
import type { EngineCall } from './engine'
import type { Ingested, Store } from './store'
import { join } from 'node:path'
import { runEngine } from './engine'

const VERDICTS: Verdict[] = ['show', 'hide']
/** Earlier recap and question lines of the session that go into the prompt */
export const CONTEXT_LINES = 5
/** How many of the session's lines after the user's latest feedback are judged with it */
export const FEEDBACK_LINES = 3
const FEEDBACK_MAX = 200

export const SYSTEM_PROMPT = `You decide whether one line from a coding agent session is shown to a developer who watches several sessions at once.
The line is the session's own recap of a turn it just finished.

show: a result (success or failure, with or without counts), an error, a blocker, a decision, or anything the developer should read or act on.
hide: a step update with nothing to act on (started X, moved on to Y), waiting, polling, elapsed-time ticks, "still running", "nothing new", "no feedback yet", heartbeats.
When the developer's latest feedback to the session is given, show a line that answers or acts on it.
Judge the new line itself; earlier lines are context only. When unsure, show.
Answer with the JSON object only.`

export interface PromptInput {
  session: string
  hasImages: boolean
  /** Earlier lines of the session, oldest first */
  context: string[]
  /** The user's latest feedback to the session, for the first lines after it */
  feedback?: string
  line: string
}

function questionText(questions: Question[]): string {
  return questions
    .map(q => `${q.question}${q.options.length ? ` (options: ${q.options.map(o => o.label).join(' / ')})` : ''}`)
    .join('\n')
}

export function buildPrompt(p: PromptInput): string {
  const context = p.context.length ? p.context.map(l => `- ${l}`).join('\n') : '(none)'
  const feedback = p.feedback ? `Developer's latest feedback to this session:\n${p.feedback}\n\n` : ''
  return `Session: ${p.session}\nTurn has images: ${p.hasImages ? 'yes' : 'no'}\nEarlier in this session (oldest first):\n${context}\n\n${feedback}New line (recap):\n${p.line}`
}

/** A message's recap and question lines, as context for later lines */
export function contextLines(m: StreamMessage): string[] {
  if (m.kind === 'question')
    return m.questions?.length ? [`question: ${questionText(m.questions).replace(/\n/g, ' · ')}`] : []
  return (m.recaps ?? (m.text ? [m.text] : [])).map(r => `recap: ${r}`)
}

function clamp(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return [...t].length > max ? `${[...t].slice(0, max - 1).join('')}…` : t
}

/** Checks a model answer against the schema; null for anything malformed */
export function toTriage(raw: unknown, at: { messageId: number, index: number }): Triage | null {
  if (!raw || typeof raw !== 'object')
    return null
  const verdict = (raw as Record<string, unknown>).verdict as Verdict
  return VERDICTS.includes(verdict) ? { ...at, verdict } : null
}

/**
 * Cache key for a recap: case, spacing and numbers do not matter, so 「1/10 경과」 and
 * 「2/10 경과」 share one. That would also merge 「0건 실패」 and 「3건 실패」, so the cache
 * only ever holds hide verdicts.
 */
export function cacheKey(text: string): string {
  return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim()
}

/** Runs jobs with bounded concurrency, one per key; the oldest waiting job drops past `max` */
export class JobQueue<T> {
  private waiting = new Map<string, T>()
  private running = new Set<string>()
  private drained: (() => void)[] = []

  constructor(private run: (job: T) => Promise<void>, private concurrency = 2, private max = 100) {}

  push(key: string, job: T): void {
    if (this.waiting.has(key) || this.running.has(key))
      return
    this.waiting.set(key, job)
    if (this.waiting.size > this.max)
      this.waiting.delete(this.waiting.keys().next().value!)
    this.pump()
  }

  clear(): void {
    this.waiting.clear()
  }

  get size(): number {
    return this.waiting.size + this.running.size
  }

  /** Resolves once nothing is waiting or running */
  idle(): Promise<void> {
    return this.size ? new Promise(resolve => this.drained.push(resolve)) : Promise.resolve()
  }

  private pump(): void {
    while (this.running.size < this.concurrency && this.waiting.size) {
      const [key, job] = this.waiting.entries().next().value as [string, T]
      this.waiting.delete(key)
      this.running.add(key)
      this.run(job).catch(() => {}).finally(() => {
        this.running.delete(key)
        this.pump()
        if (!this.size)
          this.drained.splice(0).forEach(resolve => resolve())
      })
    }
  }
}

interface Job {
  engine: Exclude<TriageEngine, 'off'>
  messageId: number
  index: number
  /** The user's latest feedback, when this line is among the first FEEDBACK_LINES after it */
  feedback?: string
}

export type Runner = (engine: Exclude<TriageEngine, 'off'>, call: EngineCall) => Promise<unknown>

/** Queues a triage call for each new recap line; never blocks ingestion */
export class Triager {
  readonly queue: JobQueue<Job>
  /** Per session: the latest delivered feedback seen at ingest, and how many lines came after it */
  private afterFeedback = new Map<string, { id: number, lines: number }>()
  /** Feedback delivered before this process started may already have had its lines */
  private readonly startedAt = Date.now()

  constructor(
    private store: Store,
    private publish: (t: Triage) => void,
    private options: { dataDir: string, selfUrl?: string, run?: Runner, concurrency?: number },
  ) {
    this.queue = new JobQueue(job => this.process(job), options.concurrency ?? 2)
  }

  /** Called after an event is stored */
  onIngest(event: IncomingEvent, result: Ingested): void {
    const engine = this.store.settings().triage
    const m = result.message
    if (engine === 'off' || !m || event.kind !== 'recap')
      return
    // A continuation adds a line to an existing turn; only that new line is judged
    const index = Math.max(0, (m.recaps?.length ?? 1) - 1)
    const feedback = this.feedbackFor(m.sessionId)
    this.queue.push(`${m.id}:${index}`, { engine, messageId: m.id, index, ...(feedback ? { feedback } : {}) })
  }

  /** The engine changed: calls already queued for the old one are dropped */
  onSettings(engine: TriageEngine): void {
    if (engine === 'off')
      this.queue.clear()
  }

  /**
   * Counted at ingest, in arrival order: an answer to feedback delivered on Stop is a
   * continuation line of a turn that began before the feedback, so message times can't tell.
   */
  private feedbackFor(sessionId: string): string | undefined {
    const last = this.store.lastDelivered(sessionId)
    if (!last?.text.trim())
      return undefined
    const seen = this.afterFeedback.get(sessionId)
    let lines = 0
    if (seen?.id === last.id)
      lines = seen.lines
    else if (!seen && last.deliveredAt! < this.startedAt)
      return undefined
    if (lines >= FEEDBACK_LINES)
      return undefined
    this.afterFeedback.set(sessionId, { id: last.id, lines: lines + 1 })
    return clamp(last.text, FEEDBACK_MAX)
  }

  private async process(job: Job): Promise<void> {
    const m = this.store.get(job.messageId)
    if (!m || this.store.settings().triage !== job.engine)
      return
    const recaps = m.recaps ?? (m.text ? [m.text] : [])
    const text = recaps[job.index]
    if (text === undefined)
      return
    const at = { messageId: m.id, index: job.index }

    // A line that may answer the user's feedback always goes to the model
    const key = cacheKey(text)
    if (!job.feedback && this.store.cachedVerdict(key) === 'hide') {
      this.save({ ...at, verdict: 'hide' })
      return
    }

    const earlier = this.store.previous(m.sessionId, m.id, CONTEXT_LINES).flatMap(contextLines)
    // Earlier recaps of the same turn come before a continuation line
    const context = [...earlier, ...recaps.slice(0, job.index).map(r => `recap: ${r}`)].slice(-CONTEXT_LINES)
    const input = buildPrompt({ session: m.sessionName, hasImages: !!m.images?.length, context, feedback: job.feedback, line: text })
    const run = this.options.run ?? runEngine
    const raw = await run(job.engine, { system: SYSTEM_PROMPT, input, workDir: join(this.options.dataDir, 'triage'), selfUrl: this.options.selfUrl })
    const triage = toTriage(raw, at)
    // A failed call stores nothing, so the line stays shown
    if (!triage)
      return
    if (triage.verdict === 'hide')
      this.store.cacheVerdict(key, 'hide')
    this.save(triage)
  }

  private save(t: Triage): void {
    this.store.saveTriage(t)
    this.publish(t)
  }
}
