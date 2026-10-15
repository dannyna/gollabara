// What session chat shows once the server triages it (#32). Pure rules, so the hide and
// hold behavior is testable. With the engine off, the chat is exactly what arrived.

import type { StreamMessage, Triage, TriageEngine } from '../../src/shared/types'

/**
 * How long a new recap-only line may wait for its verdict before it shows anyway. A model
 * verdict takes about 3–9 s, so a shorter hold would let a hidden line flash in and then vanish.
 */
export const HOLD_MS = 10_000

export const triageKey = (messageId: number, index: number) => `${messageId}:${index}`

export function toTriageMap(list: Triage[]): Map<string, Triage> {
  return new Map(list.map(t => [triageKey(t.messageId, t.index), t]))
}

export interface LineView {
  index: number
  text: string
  /** Judged hidden and shown only because hidden messages are revealed */
  dim: boolean
}

export interface MessageView {
  message: StreamMessage
  lines: LineView[]
  /** Every line shown is a dim hidden line */
  dim: boolean
}

export interface TriageViewInput {
  engine: TriageEngine
  triage: ReadonlyMap<string, Triage>
  /** When each recap line arrived live, by triageKey; lines from the first hello are absent */
  arrivals?: ReadonlyMap<string, number>
  now: number
  /** The header toggle: hidden lines show inline, dimmed */
  showHidden?: boolean
  holdMs?: number
}

export interface TriageView {
  items: MessageView[]
  /** Hidden lines kept out of the timeline (also while revealed, for the toggle label) */
  hidden: number
  /** When the earliest held line stops waiting, so the caller can look again */
  nextCheck: number | null
}

const recapsOf = (m: StreamMessage) => m.recaps ?? (m.text ? [m.text] : [])

/**
 * Applies verdicts to the chat. Images and questions are never hidden or held: only lines of
 * recap-only messages judged hidden drop out, and a message goes when all its lines do. A new
 * recap-only line with no verdict yet waits up to `holdMs`, then shows.
 */
export function triageView(messages: StreamMessage[], input: TriageViewInput): TriageView {
  const plain = (message: StreamMessage): MessageView => ({
    message,
    dim: false,
    lines: recapsOf(message).map((text, index) => ({ index, text, dim: false })),
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
    const lines: LineView[] = []
    recapsOf(message).forEach((text, index) => {
      const key = triageKey(message.id, index)
      const t = input.triage.get(key)
      const line: LineView = { index, text, dim: false }
      if (protectedTurn) {
        lines.push(line)
      }
      else if (t?.verdict === 'hide') {
        hidden++
        if (input.showHidden)
          lines.push({ index, text, dim: true })
      }
      else if (!t && input.arrivals?.has(key) && input.now - input.arrivals.get(key)! < hold) {
        const until = input.arrivals.get(key)! + hold
        nextCheck = nextCheck == null ? until : Math.min(nextCheck, until)
      }
      else {
        lines.push(line)
      }
    })
    if (protectedTurn || lines.length || !recapsOf(message).length)
      items.push({ message, lines, dim: !protectedTurn && lines.length > 0 && lines.every(l => l.dim) })
  }
  return { items, hidden, nextCheck }
}

/** Recap lines that are new in `next` compared with `prev`, as triage keys */
export function newLines(prev: StreamMessage | undefined, next: StreamMessage): string[] {
  const before = prev ? recapsOf(prev).length : 0
  return recapsOf(next).slice(before).map((_, i) => triageKey(next.id, before + i))
}
