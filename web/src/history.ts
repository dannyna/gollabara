// History beyond what the hello sent (#77). The views hold one run of messages with no gap: the
// latest ones while live, or a run that starts at a day the reader jumped to. Pages extend the run
// at either end. While the run does not reach the latest, live frames for newer messages wait
// in a buffer: they are counted for 「새 … n」 and join once the run meets the latest again.

import type { Feedback, HistoryDay, HistoryPage, StreamMessage, Triage } from '../../src/shared/types'
import { roleOf } from './artifacts'
import { mergeFeedback } from './feedback'
import { triageKey } from './triage'

/** Messages a jump or 「최신으로」 loads at once, as many as the hello sends */
export const WINDOW_SIZE = 300
/** Messages one page adds at either end */
export const PAGE_SIZE = 200
export const DAY_MS = 86_400_000

/** What the views need to know about the run they show */
export interface HistoryState {
  /** Messages exist before the first one loaded */
  older: boolean
  /** The run reaches the latest message, so live frames join it */
  live: boolean
  /** A page is on its way */
  loading: 'older' | 'newer' | 'jump' | null
  /** Bumped by every page that extends the run; the views keep their place instead of following */
  pages: number
  /** Bumped by a jump or 「최신으로」: the views land on `day` (local midnight), or on the latest when null */
  land: { epoch: number, day: number | null }
  /** Live messages and artifacts waiting past the end of a run that does not reach the latest */
  behind: { messages: number, artifacts: number }
}

export const initialHistory = (): HistoryState => ({ older: false, live: true, loading: null, pages: 0, land: { epoch: 0, day: null }, behind: { messages: 0, artifacts: 0 } })

/** One page joined to the run at the end it extends; a message already loaded keeps its newer copy */
export function joinPage(list: StreamMessage[], page: StreamMessage[], end: 'older' | 'newer'): StreamMessage[] {
  const ids = new Set(list.map(m => m.id))
  const fresh = page.filter(m => !ids.has(m.id))
  return end === 'older' ? [...fresh, ...list] : [...list, ...fresh]
}

/**
 * Where a live frame goes: into the run when it is live or the message is already in it, else the
 * buffer, which keeps the latest copy of each message the run has not reached
 */
export function routeFrame(list: StreamMessage[], live: boolean, message: StreamMessage): 'run' | 'buffer' {
  return live || list.some(m => m.id === message.id) ? 'run' : 'buffer'
}

/** What waits in the buffer: messages, and the artifact images among them (references never count) */
export function behindCounts(buffer: ReadonlyMap<number, StreamMessage>): HistoryState['behind'] {
  let artifacts = 0
  for (const m of buffer.values()) artifacts += (m.images ?? []).filter(i => roleOf(i) === 'artifact').length
  return { messages: buffer.size, artifacts }
}

/**
 * The run after a hello. A run that does not reach the latest stays as it is; a live one keeps the
 * older pages it loaded when they meet the hello's messages, so a reconnect never throws them away.
 */
export function helloRun(list: StreamMessage[], live: boolean, hello: StreamMessage[], helloOlder: boolean, older: boolean): { messages: StreamMessage[], older: boolean } {
  if (!live)
    return { messages: list, older }
  const oldest = hello[0]?.id
  const kept = oldest === undefined ? [] : list.filter(m => m.id < oldest)
  if (!kept.length || !list.some(m => m.id >= oldest!))
    return { messages: hello, older: helloOlder }
  return { messages: [...kept, ...hello], older }
}

/** A page's verdicts and feedback joined to what the views hold */
export function joinTriage(map: ReadonlyMap<string, Triage>, triage: Triage[]): Map<string, Triage> {
  const next = new Map(map)
  for (const t of triage) next.set(triageKey(t.messageId, t.index), t)
  return next
}
export const joinFeedback = (list: Feedback[], more: Feedback[]) => more.reduce(mergeFeedback, list)

/** Local midnight of the day `at` falls on */
export const startOfDay = (at: number) => new Date(at).setHours(0, 0, 0, 0)

/**
 * Whether a jump to the day starting at `day` can stay in the loaded run: it holds messages of that
 * day, and the day's start is not cut off by older messages that are not loaded
 */
export function dayLoaded(list: StreamMessage[], older: boolean, day: number): boolean {
  const first = list[0]
  if (!first || (older && first.at >= day))
    return false
  return list.some(m => m.at >= day && m.at < day + DAY_MS)
}

/** This view's UTC offset in minutes, east positive, as the days endpoint takes it */
export const utcOffset = (at = Date.now()) => -new Date(at).getTimezoneOffset()

async function getJson<T>(url: string, fetcher: typeof fetch): Promise<T> {
  let res: Response
  try {
    res = await fetcher(url)
  }
  catch {
    throw new Error('서버에 연결하지 못했어요')
  }
  if (!res.ok)
    throw new Error('기록을 불러오지 못했어요')
  return await res.json() as T
}

/** One page: before or after a message id, from a time in ms, or the latest with no cursor */
export function fetchPage(cursor: { before?: number, after?: number, from?: number }, limit: number, fetcher: typeof fetch = fetch): Promise<HistoryPage> {
  const params = new URLSearchParams({ limit: String(limit) })
  for (const [key, value] of Object.entries(cursor)) params.set(key, String(value))
  return getJson(`/api/history?${params}`, fetcher)
}

/** Days that hold messages, newest first; only one session's days when scoped */
export function fetchDays(session: string | null, fetcher: typeof fetch = fetch): Promise<HistoryDay[]> {
  const params = new URLSearchParams({ tz: String(utcOffset()) })
  if (session)
    params.set('session', session)
  return getJson(`/api/history/days?${params}`, fetcher)
}
