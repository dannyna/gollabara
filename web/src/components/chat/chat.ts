// Pure rules behind the session chat components (OD guide: session-chat-components.html)

import type { Question, Session, StreamMessage } from '../../../../src/shared/types'
import type { MyEntry } from '../../feedback'
import type { HiddenLine } from '../../triage'
import type { Thumb } from './ArtifactThumbs.vue'
import type { IconName } from './icons'
import { artifactKey, roleOf, splitSessionName } from '../../artifacts'

export interface ChoiceOption {
  label: string
  description?: string
  recommended: boolean
}

const RECOMMENDED = /\s*\(recommended\)\s*$/i

/** Drops a trailing 「(Recommended)」 from the label and turns it into the 추천 mark */
export function toChoice(option: Question['options'][number]): ChoiceOption {
  const recommended = RECOMMENDED.test(option.label)
  return { label: option.label.replace(RECOMMENDED, ''), description: option.description, recommended }
}

/** Short labels without descriptions sit side by side; anything else gets one row per option */
export function choiceLayout(options: ChoiceOption[]): 'short' | 'rows' {
  const short = options.length <= 3 && options.every(o => !o.description && [...o.label].length <= 8)
  return short ? 'short' : 'rows'
}

/** What follows 「…로 답했어요」: the part of each picked label before its ` · ` description */
export function answerLabel(options: ChoiceOption[], picks: number[]): string {
  return picks.map(i => options[i]?.label.split(' · ')[0]).filter(Boolean).join(', ')
}

/** The step a question set shows: stays within its questions, whatever was asked for */
export function clampStep(step: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.trunc(step) || 0))
}

/** Accessible name of a progress dot: 「질문 2 · 대화 표시」, or 「질문 2」 without a header */
export function stepName(index: number, question: Question): string {
  return question.header ? `질문 ${index + 1} · ${question.header}` : `질문 ${index + 1}`
}

export interface StepNav {
  /** The step actually shown, within the set */
  step: number
  dots: { step: number, label: string, current: boolean }[]
  /** 「이전 질문」's target; none on the first question, which reads 「첫 질문」 */
  previous?: number
  /** 「다음 · header」's target; none on the last question, which reads 「마지막 질문이에요」 */
  next?: { step: number, header: string }
}

/** Where a question set's controls lead from one step: the dots, 이전 질문 and the next-question row */
export function stepNav(questions: Question[], step: number): StepNav {
  const at = clampStep(step, questions.length)
  const following = questions[at + 1]
  return {
    step: at,
    dots: questions.map((q, i) => ({ step: i, label: stepName(i, q), current: i === at })),
    previous: at > 0 ? at - 1 : undefined,
    next: following ? { step: at + 1, header: following.header || `질문 ${at + 2}` } : undefined,
  }
}

/** Mono line under a thumbnail strip. Turns carry no tool name, so it is shown only when known. */
export function outputLabel(count: number, toolName?: string): string {
  const tool = toolName?.split('__').at(-1)
  return tool ? `${tool} · ${count}장` : `${count}장`
}

/** A turn's images as chat thumbnails, artifacts and references apart; keys are the stream's capture keys */
export function turnThumbs(m: StreamMessage): { artifacts: Thumb[], references: Thumb[] } {
  const artifacts: Thumb[] = []
  const references: Thumb[] = []
  ;(m.images ?? []).forEach((image, i) => {
    const thumb = { key: artifactKey(m.id, i), ...image, at: image.at ?? m.at }
    if (roleOf(image) === 'reference')
      references.push(thumb)
    else
      artifacts.push(thumb)
  })
  return { artifacts, references }
}

/** One letter for the session avatar */
export const sessionInitial = (name: string) => splitSessionName(name).session.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toLowerCase()

const startOfDay = (at: number) => new Date(at).setHours(0, 0, 0, 0)

export function dayLabel(at: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000)
  if (days === 0)
    return '오늘'
  if (days === 1)
    return '어제'
  return new Date(at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

/** A one-line change in the feed: a session started, or the reader muted one */
export interface SystemEvent {
  key: string
  at: number
  icon: IconName
  text: string
  /** A mute line: the avatar before `text` opens that session's menu */
  sessionId?: string
}

/** One row of the avatar menu. `why` disables it and says why at its right end. */
export interface SessionMenuItem {
  action: 'scope' | 'mute' | 'delete'
  icon: IconName
  label: string
  why?: string
}

/**
 * The avatar menu's rows (OD chat guide 07). Scope and mute flip with the state they change, and a
 * muted session cannot become the scope, as in the session menu. Delete asks first (ConfirmDialog).
 */
export function sessionMenuItems(scoped: boolean, muted: boolean): SessionMenuItem[] {
  return [
    scoped
      ? { action: 'scope', icon: 'all', label: '전체 세션 보기' }
      : { action: 'scope', icon: 'scope', label: '이 세션만 보기', ...(muted ? { why: '음소거 중' } : {}) },
    muted
      ? { action: 'mute', icon: 'sound', label: '음소거 해제' }
      : { action: 'mute', icon: 'mute', label: '음소거' },
    { action: 'delete', icon: 'trash', label: '이 세션 데이터 삭제' },
  ]
}

/** One 「… 시작」 row */
export interface StartRow {
  key: string
  sessionId: string
  /** `<dir>` or `<dir> · <branch>` */
  name: string
  at: number
}

export type TimelineItem
  = | { type: 'date', key: string, label: string }
    | ({ type: 'system' } & SystemEvent)
    | ({ type: 'start' } & StartRow)
    | { type: 'message', key: string, message: StreamMessage }
    | { type: 'mine', key: string, entry: MyEntry }

/** What the feed draws once hidden messages fold and nearby starts group */
export type FeedItem
  = | Exclude<TimelineItem, { type: 'start' }>
    // Consecutive fully hidden messages, across sessions, in one 「숨긴 메시지 n」 row
    | { type: 'hidden', key: string, lines: HiddenLine[] }
    // Consecutive messages that hold nothing but references, in one 「참고 이미지 n」 row
    | { type: 'refs', key: string, thumbs: Thumb[] }
    /** `lead`: the next item is a message from one of these sessions, so it sits closer (8px) */
    | { type: 'starts', key: string, rows: StartRow[], lead: boolean }

/**
 * Orders what the chat feed draws: a date line whenever the day changes, a 「… 시작」 row
 * where a session started, other system lines and the reader's own bubbles at their time,
 * then the messages. A start older than the oldest loaded message is out of view and gets
 * no row; sessions with nothing in view get none either. `since` is where a run with older
 * messages not yet loaded starts (#77): lines and bubbles before it belong to those messages, so
 * they wait until those are.
 */
export function toTimeline(messages: StreamMessage[], sessions: Session[] = [], events: SystemEvent[] = [], now = Date.now(), mine: MyEntry[] = [], since = -Infinity): TimelineItem[] {
  const oldest = messages[0]?.at ?? -Infinity
  const inView = new Set(messages.map(m => m.sessionId))
  const lines = sessions
    .filter(s => inView.has(s.id) && s.startedAt >= oldest)
    .map(s => ({ at: s.startedAt, item: { type: 'start', key: `start-${s.id}`, sessionId: s.id, name: s.name, at: s.startedAt } as TimelineItem }))
    .concat(events.map(e => ({ at: e.at, item: { type: 'system' as const, ...e } })))
    .concat(mine.map(entry => ({ at: entry.at, item: { type: 'mine', key: entry.key, entry } })))
    .filter(l => l.at >= since)
    .sort((a, b) => a.at - b.at)

  const rows: { at: number, item: TimelineItem }[] = []
  let s = 0
  for (const m of messages) {
    while (s < lines.length && lines[s]!.at <= m.at)
      rows.push(lines[s++]!)
    rows.push({ at: m.at, item: { type: 'message', key: `m-${m.id}`, message: m } })
  }
  rows.push(...lines.slice(s))

  const out: TimelineItem[] = []
  let day: number | null = null
  for (const { at, item } of rows) {
    if (startOfDay(at) !== day) {
      day = startOfDay(at)
      out.push({ type: 'date', key: `d-${day}`, label: dayLabel(at, now) })
    }
    out.push(item)
  }
  return out
}

/** Starts within this long of a group's first one sit together, 2px apart */
export const START_GROUP_MS = 5 * 60 * 1000
/** A larger group shows this many rows and folds the rest into 「외 n개」 */
export const STARTS_SHOWN = 3

/**
 * Folds hidden lines into rows and groups starts. Messages `hiddenOf` returns lines for are
 * folded; consecutive ones merge into one row, across sessions, until anything else is drawn
 * between them. Each row's key is its first line's, so a growing row keeps its open state.
 * Messages `refsOf` returns thumbnails for (nothing to show but references) fold the same way
 * into 「참고 이미지 n」 rows. Starts with nothing between them, within START_GROUP_MS, form one group.
 */
export function toFeed(items: TimelineItem[], hiddenOf: (m: StreamMessage) => HiddenLine[] | null, refsOf: (m: StreamMessage) => Thumb[] | null = () => null): FeedItem[] {
  const out: FeedItem[] = []
  for (const item of items) {
    const last = out.at(-1)
    if (item.type === 'message') {
      const lines = hiddenOf(item.message)
      if (lines) {
        if (last?.type === 'hidden')
          last.lines.push(...lines)
        else
          out.push({ type: 'hidden', key: `h-${lines[0]!.key}`, lines: [...lines] })
        continue
      }
      const thumbs = refsOf(item.message)
      if (thumbs?.length) {
        if (last?.type === 'refs')
          last.thumbs.push(...thumbs)
        else
          out.push({ type: 'refs', key: `r-${thumbs[0]!.key}`, thumbs: [...thumbs] })
        continue
      }
    }
    if (item.type === 'start') {
      const { type: _, ...row } = item
      if (last?.type === 'starts' && row.at - last.rows[0]!.at <= START_GROUP_MS)
        last.rows.push(row)
      else
        out.push({ type: 'starts', key: item.key, rows: [row], lead: false })
      continue
    }
    out.push(item)
  }
  out.forEach((item, i) => {
    const next = out[i + 1]
    if (item.type === 'starts' && next?.type === 'message')
      item.lead = item.rows.some(r => r.sessionId === next.message.sessionId)
  })
  return out
}
