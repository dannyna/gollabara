// What session chat shows once the server triages it (#32, #37). Pure rules, so the hide,
// hold and state behavior is testable. With the engine off, the chat is exactly what arrived.

import type { StreamMessage, Tone, Triage, TriageEngine } from '../../src/shared/types'

/**
 * How long a new recap-only line may wait for its verdict before it shows anyway. A model
 * verdict takes about 3–9 s, so a shorter hold would let a hidden line flash in and then fold.
 */
export const HOLD_MS = 10_000

export const triageKey = (messageId: number, index: number) => `${messageId}:${index}`

export function toTriageMap(list: Triage[]): Map<string, Triage> {
  return new Map(list.map(t => [triageKey(t.messageId, t.index), t]))
}

export interface LineView {
  index: number
  text: string
  tone: Tone
  /**
   * The session's latest stated line, drawn as a filled box. Earlier stated lines keep only
   * their icon: the app can't tell whether a later success resolved an earlier failure.
   */
  filled: boolean
  /** Judged hidden after it was already on screen: dimmed in place rather than pulled away */
  weak: boolean
}

/** A hidden line as an expanded 「숨긴 메시지 n」 row lists it */
export interface HiddenLine {
  key: string
  sessionName: string
  at: number
  text: string
}

export type BodyPart
  = | { type: 'line', line: LineView }
    // Hidden lines between shown lines of one turn fold into a row in place
    | { type: 'hidden', key: string, lines: HiddenLine[] }

export interface MessageView {
  message: StreamMessage
  parts: BodyPart[]
  /** Every line is hidden: the whole message folds into a 「숨긴 메시지 n」 row in the feed */
  folded: boolean
}

export interface TriageViewInput {
  engine: TriageEngine
  triage: ReadonlyMap<string, Triage>
  /** When each recap line arrived live, by triageKey; lines from the first hello are absent */
  arrivals?: ReadonlyMap<string, number>
  now: number
  /** Lines already drawn as shown, by triageKey. A late hide verdict on one dims it in place. */
  seen?: ReadonlySet<string>
  holdMs?: number
}

export interface TriageView {
  items: MessageView[]
  /** Hidden lines folded into rows */
  hidden: number
  /** When the earliest held line stops waiting, so the caller can look again */
  nextCheck: number | null
}

const recapsOf = (m: StreamMessage) => m.recaps ?? (m.text ? [m.text] : [])

function line(index: number, text: string, tone: Tone = 'default', weak = false): BodyPart {
  return { type: 'line', line: { index, text, tone, filled: false, weak } }
}

/**
 * Applies verdicts to the chat. Images and questions are never hidden or held: only lines of
 * recap-only messages judged hidden fold, and a message folds whole when all its lines do. A new
 * recap-only line with no verdict yet waits up to `holdMs`, then shows. A line already on screen
 * (in `seen`) is never pulled away by a later hide verdict; it dims in place.
 */
export function triageView(messages: StreamMessage[], input: TriageViewInput): TriageView {
  const plain = (message: StreamMessage): MessageView => ({
    message,
    folded: false,
    parts: recapsOf(message).map((text, index) => line(index, text)),
  })
  if (input.engine === 'off')
    return { items: messages.map(plain), hidden: 0, nextCheck: null }

  const hold = input.holdMs ?? HOLD_MS
  let hidden = 0
  let nextCheck: number | null = null
  const items: MessageView[] = []
  for (const message of messages) {
    if (message.kind === 'question') {
      items.push(plain(message))
      continue
    }
    const protectedTurn = !!message.images?.length || !!message.questions?.length
    const parts: BodyPart[] = []
    let shown = 0
    let held = 0
    recapsOf(message).forEach((text, index) => {
      const key = triageKey(message.id, index)
      const t = input.triage.get(key)
      const tone = t?.verdict === 'show' ? t.tone ?? 'default' : 'default'
      if (protectedTurn) {
        parts.push(line(index, text, tone))
        shown++
      }
      else if (t?.verdict === 'hide' && input.seen?.has(key)) {
        parts.push(line(index, text, 'default', true))
        shown++
      }
      else if (t?.verdict === 'hide') {
        hidden++
        const entry = { key, sessionName: message.sessionName, at: message.at, text }
        const last = parts.at(-1)
        if (last?.type === 'hidden')
          last.lines.push(entry)
        else
          parts.push({ type: 'hidden', key: `h-${key}`, lines: [entry] })
      }
      else if (!t && input.arrivals?.has(key) && input.now - input.arrivals.get(key)! < hold) {
        const until = input.arrivals.get(key)! + hold
        nextCheck = nextCheck == null ? until : Math.min(nextCheck, until)
        held++
      }
      else {
        parts.push(line(index, text, tone))
        shown++
      }
    })
    if (protectedTurn || shown || !recapsOf(message).length)
      items.push({ message, parts, folded: false })
    // A turn with nothing shown yet but a line still on hold waits whole, as before
    else if (!held)
      items.push({ message, parts, folded: true })
  }
  markLatest(items)
  return { items, hidden, nextCheck }
}

/**
 * Within a session only the most recent stated line is filled. Default lines don't clear an
 * earlier state: a failure stays filled through progress reports until another state comes.
 */
function markLatest(items: MessageView[]): void {
  const latest = new Map<string, LineView>()
  for (const item of items) {
    if (item.folded)
      continue
    for (const part of item.parts) {
      if (part.type === 'line' && part.line.tone !== 'default')
        latest.set(item.message.sessionId, part.line)
    }
  }
  for (const l of latest.values())
    l.filled = true
}

/** Keys of the lines `view` draws as shown, for `seen` */
export function shownKeys(view: TriageView): string[] {
  return view.items.flatMap(item => item.folded
    ? []
    : item.parts.flatMap(p => p.type === 'line' && !p.line.weak ? [triageKey(item.message.id, p.line.index)] : []))
}

/** Recap lines that are new in `next` compared with `prev`, as triage keys */
export function newLines(prev: StreamMessage | undefined, next: StreamMessage): string[] {
  const before = prev ? recapsOf(prev).length : 0
  return recapsOf(next).slice(before).map((_, i) => triageKey(next.id, before + i))
}
