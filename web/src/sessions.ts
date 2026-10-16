// Session scope and mute for the session menu. Mute is a client-side filter only:
// it hides a session in this browser and sends nothing to the session.

import type { Harness, Session, SessionState, StreamMessage } from '../../src/shared/types'
import { ref } from 'vue'
import { splitSessionName } from './artifacts'

export interface SessionRow {
  id: string
  session: string
  branch?: string
  /** Parent path when another session has the same name (names.ts) */
  hint?: string
  lastSeenAt: number
  muted: boolean
  /** The session ended (its process is gone); it fades, and only a search lists it */
  ended: boolean
  /** It has a record and has not ended (working, waiting or idle): the session menu lists it without a search */
  live: boolean
  /** From the record; a message-only row has none */
  harness?: Harness
  /** What a live session is doing; an ended or message-only row has none */
  state?: SessionState
}

/** The session menu's monogram: one letter per harness */
export const HARNESS_MARK: Record<Harness, string> = {
  'claude-code': 'C',
  'codex': 'X',
  'open-design': 'O',
  'claude-design': 'D',
}

const startOfDay = (at: number) => new Date(at).setHours(0, 0, 0, 0)

/** A row's last activity: 「방금」, minutes or hours ago today, 「어제」, else the date */
export function activityLabel(at: number, now = Date.now()): string {
  const minutes = Math.floor((now - at) / 60_000)
  if (minutes < 1)
    return '방금'
  if (minutes < 60)
    return `${minutes}분 전`
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000)
  if (days === 0)
    return `${Math.floor(minutes / 60)}시간 전`
  if (days === 1)
    return '어제'
  const d = new Date(at)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * One row per session, most recent first. Sessions that only appear in messages
 * (stored before session records existed) are listed too; they have no path, so no hint.
 */
export function toSessionRows(sessions: Session[], messages: StreamMessage[], muted: ReadonlySet<string>, hintOf: (id: string) => string | undefined = () => undefined): SessionRow[] {
  const rows = new Map<string, SessionRow>()
  for (const s of sessions) {
    const hint = hintOf(s.id)
    const ended = s.endedAt != null
    rows.set(s.id, { id: s.id, ...splitSessionName(s.name), ...(hint ? { hint } : {}), lastSeenAt: s.lastSeenAt, muted: muted.has(s.id), ended, live: !ended, harness: s.harness, ...(s.state && !ended ? { state: s.state } : {}) })
  }
  for (const m of messages) {
    const row = rows.get(m.sessionId)
    if (!row)
      rows.set(m.sessionId, { id: m.sessionId, ...splitSessionName(m.sessionName), lastSeenAt: m.at, muted: muted.has(m.sessionId), ended: false, live: false })
    else if (m.at > row.lastSeenAt)
      row.lastSeenAt = m.at
  }
  return [...rows.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt)
}

/**
 * Rows whose name (with its hint, so `repo2/e2e` finds it), or branch, holds `query`, ignoring case
 * and the spaces around it; every row for an empty one
 */
export function filterSessions<T extends Pick<SessionRow, 'session' | 'branch' | 'hint'>>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  return q ? rows.filter(r => `${r.hint ?? ''}${r.session}`.toLowerCase().includes(q) || !!r.branch?.toLowerCase().includes(q)) : rows
}

/**
 * The session menu's rows: only live sessions until the user searches, so ended and message-only
 * sessions stay out of the way but their history can still be scoped by name. The search field sits
 * above 「전체 세션」, which every query keeps.
 */
export function listedSessions<T extends Pick<SessionRow, 'session' | 'branch' | 'hint' | 'live'>>(rows: T[], query: string): T[] {
  return query.trim() ? filterSessions(rows, query) : rows.filter(r => r.live)
}

/** Ids of the sessions that ended, so every surface can fade them */
export function endedSessions(sessions: Session[]): ReadonlySet<string> {
  return new Set(sessions.filter(s => s.endedAt != null).map(s => s.id))
}

/** Messages in view: never a muted session, and only the chosen one when scoped */
export function inScope(messages: StreamMessage[], scope: string | null, muted: ReadonlySet<string>): StreamMessage[] {
  return messages.filter(m => !muted.has(m.sessionId) && (scope == null || m.sessionId === scope))
}

/** 「이 세션 데이터 삭제」: the server drops the rows and tells every view; throws Error with the message to show */
export async function deleteSessionData(id: string, fetcher: typeof fetch = fetch): Promise<void> {
  let res: Response
  try {
    // An empty body still says JSON: the server refuses other API mutations
    res = await fetcher(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'content-type': 'application/json' } })
  }
  catch {
    throw new Error('서버에 연결하지 못했어요')
  }
  if (res.status === 403)
    throw new Error('이 Mac이나 tailnet에서만 지울 수 있어요')
  if (!res.ok)
    throw new Error('세션 데이터를 지우지 못했어요')
}

const STORAGE_KEY = 'gollabara-muted'

function readStored(): Set<string> {
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [])
  }
  catch {
    return new Set()
  }
}

const muted = ref<ReadonlySet<string>>(readStored())
/** Ids dropped because their session's data is gone; a mute change for them is not an unmute */
const forgotten = new Set<string>()

/** Muted ids whose session no longer exists (its data was deleted or expired), once the server's snapshot is in */
export function goneMutes(muted: ReadonlySet<string>, sessions: Session[], messages: StreamMessage[]): string[] {
  const known = new Set([...sessions.map(s => s.id), ...messages.map(m => m.sessionId)])
  return [...muted].filter(id => !known.has(id))
}

/** What the user muted and unmuted between two mute sets; forgotten ids are neither */
export function muteChanges(next: ReadonlySet<string>, prev: ReadonlySet<string>, gone: ReadonlySet<string> = forgotten) {
  return {
    muted: [...next].filter(id => !prev.has(id)),
    unmuted: [...prev].filter(id => !next.has(id) && !gone.has(id)),
  }
}

export function useMutedSessions() {
  function save(next: Set<string>) {
    muted.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    }
    catch {}
  }
  function toggleMute(id: string) {
    const next = new Set(muted.value)
    if (!next.delete(id))
      next.add(id)
    forgotten.delete(id)
    save(next)
  }
  /** Drops deleted sessions from the list without an unmute: nothing is shown again, so no 「음소거 해제」 line */
  function forget(ids: string[]) {
    const next = new Set(muted.value)
    for (const id of ids) {
      if (next.delete(id))
        forgotten.add(id)
    }
    if (next.size !== muted.value.size)
      save(next)
  }
  return { muted, toggleMute, forget, forgotten: forgotten as ReadonlySet<string> }
}
