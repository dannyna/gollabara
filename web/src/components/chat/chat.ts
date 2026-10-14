// Pure rules behind the session chat components (OD guide: session-chat-components.html)

import type { Question, Session, StreamMessage } from '../../../../src/shared/types'
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

export type TimelineItem
  = | { type: 'date', key: string, label: string }
    | ({ type: 'system' } & SystemEvent)
    | { type: 'message', key: string, message: StreamMessage }

/**
 * Orders what the chat feed draws: a date line whenever the day changes, a 「… 시작」 line
 * where a session started, other system lines at their time, then the messages. A start
 * older than the oldest loaded message is out of view and gets no line; sessions with
 * nothing in view get none either.
 */
export function toTimeline(messages: StreamMessage[], sessions: Session[] = [], events: SystemEvent[] = [], now = Date.now()): TimelineItem[] {
  const oldest = messages[0]?.at ?? -Infinity
  const inView = new Set(messages.map(m => m.sessionId))
  const lines = sessions
    .filter(s => inView.has(s.id) && s.startedAt >= oldest)
    .map((s): SystemEvent => ({ key: `start-${s.id}`, at: s.startedAt, icon: 'start', text: `${s.name} 시작` }))
    .concat(events)
    .map(e => ({ type: 'system' as const, ...e }))
    .sort((a, b) => a.at - b.at)

  const rows: { at: number, item: TimelineItem }[] = []
  let s = 0
  for (const m of messages) {
    while (s < lines.length && lines[s]!.at <= m.at)
      rows.push({ at: lines[s]!.at, item: lines[s++]! })
    rows.push({ at: m.at, item: { type: 'message', key: `m-${m.id}`, message: m } })
  }
  rows.push(...lines.slice(s).map(item => ({ at: item.at, item })))

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
