// Triage and advice for session chat (#32). When the user opts in, a CLI on this machine reads
// each new recap line and question in the background: signal, progress or noise, plus for
// signal and questions a short advice line and a draft reply. Only chat text is read, never
// images. Results are shown to the user only; nothing is ever sent to a session.

import type { IncomingEvent, Question, StreamMessage, Triage, TriageEngine, Verdict } from '../shared/types'
import type { EngineCall } from './engine'
import type { Ingested, Store } from './store'
import { join } from 'node:path'
import { runEngine } from './engine'

const VERDICTS: Verdict[] = ['signal', 'progress', 'noise']
/** Earlier recap and question lines of the session that go into the prompt */
export const CONTEXT_LINES = 5
const ADVICE_MAX = 120
const DRAFT_MAX = 400

export const SYSTEM_PROMPT = `You triage one line from a coding agent session for a developer who watches several sessions at once.
The line is either the session's own recap of a turn it just finished, or a question the session asked the developer.

verdict:
- signal: a result, a failure or error, a blocker, a decision, or anything the developer should read or act on.
- progress: a meaningful step update (started X, moved on to Y) with nothing to act on.
- noise: waiting, polling, elapsed-time ticks, "still running", "nothing new", "no feedback yet", heartbeats.
Judge the new line itself; earlier lines are context only. Between signal and progress, prefer signal.
Never call a failure, an error, a blocker or a question noise.

advice: only for signal lines and questions, exactly one short Korean sentence (at most 60 characters) with the action the developer should take. Do not restate the line. Bad: "결제 e2e 2건 실패입니다. 원인을 확인하세요." Good: "확인 버튼 활성 조건부터 보게 하세요." Leave it "" when there is nothing for the developer to do (a plain success), and for progress and noise.
draft: only for signal lines and questions, and only when a reply would help: a short Korean message the developer could send to the session, in the developer's own voice, as an instruction, answer or request (for example "실패한 2건 로그부터 보여 주고 원인을 고쳐 줘"). Never write it in the session's voice. Otherwise "".
Answer with the JSON object only.`

export type Line = { kind: 'recap', text: string } | { kind: 'question', questions: Question[] }

export interface PromptInput {
  session: string
  hasImages: boolean
  /** Earlier lines of the session, oldest first */
  context: string[]
  line: Line
}

function questionText(questions: Question[]): string {
  return questions
    .map(q => `${q.question}${q.options.length ? ` (options: ${q.options.map(o => o.label).join(' / ')})` : ''}`)
    .join('\n')
}

export function buildPrompt(p: PromptInput): string {
  const context = p.context.length ? p.context.map(l => `- ${l}`).join('\n') : '(none)'
  const line = p.line.kind === 'recap' ? `New line (recap):\n${p.line.text}` : `New line (question):\n${questionText(p.line.questions)}`
  return `Session: ${p.session}\nTurn has images: ${p.hasImages ? 'yes' : 'no'}\nEarlier in this session (oldest first):\n${context}\n\n${line}`
}

/** A message's recap and question lines, as context for later lines */
export function contextLines(m: StreamMessage): string[] {
  if (m.kind === 'question')
    return m.questions?.length ? [`question: ${questionText(m.questions).replace(/\n/g, ' · ')}`] : []
  return (m.recaps ?? (m.text ? [m.text] : [])).map(r => `recap: ${r}`)
}

function clamp(text: unknown, max: number): string | undefined {
  if (typeof text !== 'string')
    return undefined
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t)
    return undefined
  return [...t].length > max ? `${[...t].slice(0, max - 1).join('')}…` : t
}

/**
 * Checks a model answer against the schema. Questions are never noise, and only signal lines
 * and questions keep advice and a draft. Returns null for anything malformed.
 */
export function toTriage(raw: unknown, at: { messageId: number, index: number }, kind: Line['kind']): Triage | null {
  if (!raw || typeof raw !== 'object')
    return null
  const answer = raw as Record<string, unknown>
  if (!VERDICTS.includes(answer.verdict as Verdict))
    return null
  const verdict = kind === 'question' ? 'signal' : answer.verdict as Verdict
  const advised = verdict === 'signal'
  const advice = advised ? clamp(answer.advice, ADVICE_MAX) : undefined
  const draft = advised ? clamp(answer.draft, DRAFT_MAX) : undefined
  return { ...at, verdict, ...(advice ? { advice } : {}), ...(draft ? { draft } : {}) }
}

/**
 * Cache key for a recap: case, spacing and numbers do not matter, so 「1/10 경과」 and
 * 「2/10 경과」 share one. That would also merge 「0건 실패」 and 「3건 실패」, so the cache
 * only ever holds noise.
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
  kind: Line['kind']
}

export type Runner = (engine: Exclude<TriageEngine, 'off'>, call: EngineCall) => Promise<unknown>

/** Queues a triage call for each new recap or question; never blocks ingestion */
export class Triager {
  readonly queue: JobQueue<Job>

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
    if (engine === 'off' || !m)
      return
    if (event.kind === 'recap') {
      // A continuation adds a line to an existing turn; only that new line is judged
      const index = Math.max(0, (m.recaps?.length ?? 1) - 1)
      this.queue.push(`${m.id}:${index}`, { engine, messageId: m.id, index, kind: 'recap' })
    }
    else if (event.kind === 'question') {
      this.queue.push(`${m.id}:0`, { engine, messageId: m.id, index: 0, kind: 'question' })
    }
  }

  /** The engine changed: calls already queued for the old one are dropped */
  onSettings(engine: TriageEngine): void {
    if (engine === 'off')
      this.queue.clear()
  }

  private async process(job: Job): Promise<void> {
    const m = this.store.get(job.messageId)
    if (!m || this.store.settings().triage !== job.engine)
      return
    const recaps = m.recaps ?? (m.text ? [m.text] : [])
    const line: Line | null = job.kind === 'question'
      ? (m.questions?.length ? { kind: 'question', questions: m.questions } : null)
      : (recaps[job.index] !== undefined ? { kind: 'recap', text: recaps[job.index]! } : null)
    if (!line)
      return
    const at = { messageId: m.id, index: job.index }

    const key = line.kind === 'recap' ? cacheKey(line.text) : null
    if (key && this.store.cachedVerdict(key) === 'noise') {
      this.save({ ...at, verdict: 'noise' })
      return
    }

    const earlier = this.store.previous(m.sessionId, m.id, CONTEXT_LINES).flatMap(contextLines)
    // Earlier recaps of the same turn come before a continuation line
    const context = [...earlier, ...recaps.slice(0, job.index).map(r => `recap: ${r}`)].slice(-CONTEXT_LINES)
    const input = buildPrompt({ session: m.sessionName, hasImages: !!m.images?.length, context, line })
    const run = this.options.run ?? runEngine
    const raw = await run(job.engine, { system: SYSTEM_PROMPT, input, workDir: join(this.options.dataDir, 'triage'), selfUrl: this.options.selfUrl })
    const triage = toTriage(raw, at, line.kind)
    // A failed call stores nothing, so the line stays shown
    if (!triage)
      return
    if (key && triage.verdict === 'noise')
      this.store.cacheVerdict(key, 'noise')
    this.save(triage)
  }

  private save(t: Triage): void {
    this.store.saveTriage(t)
    this.publish(t)
  }
}
