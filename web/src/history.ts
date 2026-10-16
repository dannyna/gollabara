// Messages older than the hello sent (#77). The views hold one run of messages with no gap that
// ends at the latest; pages extend it back as the reader scrolls up.

import type { Feedback, HistoryPage, StreamMessage, Triage } from '../../src/shared/types'
import { mergeFeedback } from './feedback'
import { triageKey } from './triage'

/** Messages one page adds */
export const PAGE_SIZE = 200

/** What the views need to know about the run they show */
export interface HistoryState {
  /** Messages exist before the first one loaded */
  older: boolean
  /** A page is on its way */
  loading: boolean
  /** Bumped by every page that extends the run; the views keep their place instead of following */
  pages: number
}

export const initialHistory = (): HistoryState => ({ older: false, loading: false, pages: 0 })

/** An older page joined before the run; a message already loaded keeps its newer copy */
export function joinPage(list: StreamMessage[], page: StreamMessage[]): StreamMessage[] {
  const ids = new Set(list.map(m => m.id))
  return [...page.filter(m => !ids.has(m.id)), ...list]
}

/**
 * The run after a hello: the older pages it loaded stay when they meet the hello's messages, so a
 * reconnect never throws them away
 */
export function helloRun(list: StreamMessage[], hello: StreamMessage[], helloOlder: boolean, older: boolean): { messages: StreamMessage[], older: boolean } {
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

/** The page just before a message id */
export async function fetchPage(before: number, limit: number, fetcher: typeof fetch = fetch): Promise<HistoryPage> {
  const params = new URLSearchParams({ limit: String(limit), before: String(before) })
  let res: Response
  try {
    res = await fetcher(`/api/history?${params}`)
  }
  catch {
    throw new Error('서버에 연결하지 못했어요')
  }
  if (!res.ok)
    throw new Error('기록을 불러오지 못했어요')
  return await res.json() as HistoryPage
}
