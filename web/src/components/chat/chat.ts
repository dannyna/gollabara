// Pure rules behind the session chat components (OD guide: session-chat-components.html)

import type { Question, Session, StreamMessage } from '../../../../src/shared/types'
import type { MyEntry } from '../../feedback'
import type { HiddenLine } from '../../triage'
import type { IconName } from './icons'
import { splitSessionName } from '../../artifacts'

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

/** Mono line under a thumbnail strip. Turns carry no tool name, so it is shown only when known. */
export function outputLabel(count: number, toolName?: string): string {
  const tool = toolName?.split('__').at(-1)
  return tool ? `${tool} · ${count}장` : `${count}장`
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
    /** `lead`: the next item is a message from one of these sessions, so it sits closer (8px) */
    | { type: 'starts', key: string, rows: StartRow[], lead: boolean }

/**
 * Orders what the chat feed draws: a date line whenever the day changes, a 「… 시작」 row
 * where a session started, other system lines and the reader's own bubbles at their time,
 * then the messages. A start older than the oldest loaded message is out of view and gets
 * no row; sessions with nothing in view get none either.
 */
export function toTimeline(messages: StreamMessage[], sessions: Session[] = [], events: SystemEvent[] = [], now = Date.now(), mine: MyEntry[] = []): TimelineItem[] {
  const oldest = messages[0]?.at ?? -Infinity
  const inView = new Set(messages.map(m => m.sessionId))
  const lines = sessions
    .filter(s => inView.has(s.id) && s.startedAt >= oldest)
    .map(s => ({ at: s.startedAt, item: { type: 'start', key: `start-${s.id}`, sessionId: s.id, name: s.name, at: s.startedAt } as TimelineItem }))
    .concat(events.map(e => ({ at: e.at, item: { type: 'system' as const, ...e } })))
    .concat(mine.map(entry => ({ at: entry.at, item: { type: 'mine', key: entry.key, entry } })))
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
 * Starts with nothing between them, within START_GROUP_MS, form one group.
 */
export function toFeed(items: TimelineItem[], hiddenOf: (m: StreamMessage) => HiddenLine[] | null): FeedItem[] {
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
