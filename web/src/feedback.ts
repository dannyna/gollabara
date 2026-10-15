// Feedback the user sends to sessions: who it goes to, how server records merge,
// and what each bubble shows. The server and hook do the delivery (#22).

import type { DeliveryRoute, Feedback, FeedbackRequest, FeedbackVia, Session } from '../../src/shared/types'
import type { DeliveryState } from './components/chat/MyMessage.vue'
import type { QueueGroup } from './components/chat/QueueTray.vue'
import { clock, splitSessionName } from './artifacts'

const byCreated = (a: Feedback, b: Feedback) => a.createdAt - b.createdAt || a.id - b.id

/** Server records in send order */
export const sortFeedback = (list: Feedback[]) => [...list].sort(byCreated)

/**
 * Upserts one record by id. Never moves delivered back to queued: the hook can claim
 * before the POST response that still says queued comes back.
 */
export function mergeFeedback(list: Feedback[], next: Feedback): Feedback[] {
  const i = list.findIndex(f => f.id === next.id)
  if (i === -1)
    return sortFeedback([...list, next])
  const current = list[i]!
  if (current.deliveredAt != null && next.deliveredAt == null)
    return list
  return list.map((f, j) => j === i ? next : f)
}

/**
 * POST responses this page keeps until the stream has them, without the items the stream just dropped
 * (discarded, or their session deleted), so a removed item never comes back from a stale response
 */
export function withoutRemoved(confirmed: Feedback[], prev: Feedback[] = [], next: Feedback[] = []): Feedback[] {
  const kept = new Set(next.map(f => f.id))
  const gone = new Set(prev.filter(f => !kept.has(f.id)).map(f => f.id))
  return gone.size ? confirmed.filter(f => !gone.has(f.id)) : confirmed
}

/** Each session's feedback in send order */
export function feedbackBySession(list: Feedback[]): Map<string, Feedback[]> {
  const out = new Map<string, Feedback[]>()
  for (const f of list) {
    const group = out.get(f.sessionId)
    if (group)
      group.push(f)
    else
      out.set(f.sessionId, [f])
  }
  return out
}

/**
 * The session a message goes to. The attached image's session wins, then the session
 * in view, then one picked with @. Muted sessions are never a target; a muted winner
 * blocks rather than falling through, so a message about an image never lands elsewhere.
 */
export function resolveTarget(input: {
  attachment?: string | null
  scope?: string | null
  mention?: string | null
  muted: ReadonlySet<string>
}): string | null {
  const id = input.attachment ?? input.scope ?? input.mention ?? null
  return id != null && !input.muted.has(id) ? id : null
}

/** A send the server has not accepted yet, kept in this page only */
export interface PendingSend {
  key: string
  request: FeedbackRequest
  /** For the quote line; the request carries only the url */
  quote?: { text: string, image: string }
  at: number
  state: 'queued' | 'failed'
  /** Why it failed, when there is more to say than 「전달하지 못했어요」 */
  reason?: string
}

/** One bubble in the chat feed */
export interface MyEntry {
  key: string
  /** Where it sits in the feed */
  at: number
  sessionId: string
  text: string
  quote?: { text: string, image?: string }
  state: DeliveryState
  deliveredAt?: number
  via?: FeedbackVia
  /** Set on unsent bubbles, for retry */
  pending?: PendingSend
}

/** Quote line for feedback about an image: 「session · 14:34」 */
export function imageQuote(image: { url: string, at: number, sessionName?: string }) {
  const who = image.sessionName ? `${splitSessionName(image.sessionName).session} · ` : ''
  return { text: `${who}${clock(image.at)}`, image: image.url }
}

/**
 * Bubbles for the feed. Queued server records wait in the tray instead, so only
 * delivered ones and this page's unsent ones show here. Delivered bubbles sit at the
 * moment the session received them; 「전달됨」 marks only each session's latest one.
 */
export function toMyEntries(feedback: Feedback[], pending: PendingSend[]): MyEntry[] {
  const delivered = feedback
    .filter(f => f.deliveredAt != null)
    .sort((a, b) => a.deliveredAt! - b.deliveredAt! || a.id - b.id)
  // Last one per session wins
  const latest = new Map(delivered.map(f => [f.sessionId, f.id]))
  const sent = delivered.map((f): MyEntry => ({
    key: `f-${f.id}`,
    at: f.deliveredAt!,
    sessionId: f.sessionId,
    text: f.text,
    quote: f.image && imageQuote(f.image),
    state: latest.get(f.sessionId) === f.id ? 'delivered' : 'none',
    deliveredAt: f.deliveredAt,
    via: f.deliveredVia,
  }))
  const unsent = pending.map((p): MyEntry => ({
    key: p.key,
    at: p.at,
    sessionId: p.request.sessionId,
    text: p.request.text,
    quote: p.quote,
    state: p.state,
    pending: p,
  }))
  return [...sent, ...unsent].sort((a, b) => a.at - b.at)
}

/** How the session picked it up, for the delivered line's tooltip */
export const VIA_LABEL: Record<FeedbackVia, string> = {
  'post-tool-use': '작업 중에 전달됨',
  'stop': '턴을 마칠 때 전달됨',
  'user-prompt-submit': '다음 프롬프트와 함께 전달됨',
  'channel': '채널로 바로 전달됨',
  'rewake': '쉬던 세션을 깨워 전달됨',
}

/** Copy for a session's routes. Built from the routes alone, so it reads the same on every harness */
export const ROUTE_NOTE = {
  /** A live wake-up hook: at once, even when the session is idle */
  now: '바로 전달돼요',
  /** The next tool call, the next prompt or the turn's end (Codex, or Claude Code without a waiter) */
  hooks: '세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요',
  /** Routes unknown: a session the server never listed */
  unknown: '세션이 다음 작업을 할 때 전달돼요',
  /** Waiting sessions that differ; each tray group then says its own */
  mixed: '세션마다 전달 시점이 달라요',
  /** The session ended: nothing will pick feedback up unless it resumes */
  ended: '끝난 세션이라 전달할 수 없어요',
} as const

/** Why the composer and a failed bubble cannot send to an ended session */
export const ENDED_NOTE = '끝난 세션이에요'

/** A queue tray group's state for an ended session, in place of its route */
export const ENDED_STATUS = '끝나서 전달할 수 없어요'

/** How feedback will reach a session with these routes */
export function routeNote(routes?: readonly DeliveryRoute[]): string {
  if (!routes?.length)
    return ROUTE_NOTE.unknown
  if (routes.includes('idle-wake'))
    return ROUTE_NOTE.now
  return routes.includes('turn-end') ? ROUTE_NOTE.hooks : ROUTE_NOTE.unknown
}

/** One session's route note. A server from before routes sends only `channel`, its live wake-up hook */
export function sessionRouteNote(sessionId: string, sessions: Session[]): string {
  const session = sessions.find(s => s.id === sessionId)
  if (session?.endedAt != null)
    return ROUTE_NOTE.ended
  return routeNote(session?.routes ?? (session?.channel ? ['idle-wake'] : undefined))
}

/**
 * The queue tray's note: what every waiting session has in common, so 「바로」 only when each one
 * has a live wake-up hook. When they differ it says so, and each group carries its own (`mixed`).
 */
export function queueNote(sessionIds: string[], sessions: Session[]): { note: string, mixed: boolean } {
  const notes = new Set(sessionIds.map(id => sessionRouteNote(id, sessions)))
  if (notes.size > 1)
    return { note: ROUTE_NOTE.mixed, mixed: true }
  return { note: [...notes][0] ?? ROUTE_NOTE.unknown, mixed: false }
}

/**
 * The queue tray: one group per waiting session, keyed by its id, so two sessions with the same
 * short name never share a group. With `mixed` routes each group names its own. Items queued before
 * the session ended stay (a resume still gets them) but are said to be undeliverable, and can be discarded.
 */
export function toQueueGroups(feedback: Feedback[], sessions: Session[], mixed: boolean, nameOf: (id: string) => string): QueueGroup[] {
  const groups = new Map<string, QueueGroup>()
  for (const f of feedback) {
    if (f.deliveredAt != null)
      continue
    let group = groups.get(f.sessionId)
    if (!group) {
      const gone = sessions.some(s => s.id === f.sessionId && s.endedAt != null)
      const route = mixed && !gone ? sessionRouteNote(f.sessionId, sessions) : undefined
      groups.set(f.sessionId, group = { id: f.sessionId, session: nameOf(f.sessionId), items: [], ...(route ? { route } : {}), ...(gone ? { status: ENDED_STATUS, ended: true } : {}) })
    }
    group.items.push({ id: f.id, text: f.image ? `↪ 이미지 · ${f.text}` : f.text })
  }
  return [...groups.values()]
}

/** Drops items still queued for a session; returns the ids the server removed. Throws Error with the message to show */
export async function discardFeedback(sessionId: string, ids: number[], fetcher: typeof fetch = fetch): Promise<number[]> {
  let res: Response
  try {
    res = await fetcher('/api/feedback/discard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, ids }) })
  }
  catch {
    throw new Error('서버에 연결하지 못했어요')
  }
  if (res.status === 403)
    throw new Error('이 Mac이나 tailnet에서만 지울 수 있어요')
  if (!res.ok)
    throw new Error('대기 메시지를 지우지 못했어요')
  return (await res.json() as { feedbackIds: number[] }).feedbackIds
}

/** A failed POST: the status, or 0 when the server was not reached */
export class FeedbackSendError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/** Copy for the failed bubble; undefined keeps MyMessage's 「전달하지 못했어요」 */
export function failureReason(error: unknown): string | undefined {
  const status = error instanceof FeedbackSendError ? error.status : 0
  if (status === 403)
    return '이 Mac이나 tailnet에서만 보낼 수 있어요'
  if (status === 404)
    return '세션을 찾지 못했어요'
  // The session ended between picking it and sending
  if (status === 409)
    return ENDED_NOTE
  return undefined
}

export async function postFeedback(request: FeedbackRequest, fetcher: typeof fetch = fetch): Promise<Feedback> {
  let res: Response
  try {
    res = await fetcher('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) })
  }
  catch (error) {
    throw new FeedbackSendError(0, String(error))
  }
  if (!res.ok)
    throw new FeedbackSendError(res.status, await res.text().catch(() => ''))
  return await res.json() as Feedback
}
