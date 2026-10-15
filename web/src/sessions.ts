// Session scope and mute for the session menu. Mute is a client-side filter only:
// it hides a session in this browser and sends nothing to the session.

import type { Session, StreamMessage } from '../../src/shared/types'
import { ref } from 'vue'
import { splitSessionName } from './artifacts'

export interface SessionRow {
  id: string
  session: string
  branch?: string
  lastSeenAt: number
  muted: boolean
  /** The session ended (its process is gone); it fades but stays listed */
  ended: boolean
}

/**
 * One row per session, most recent first. Sessions that only appear in messages
 * (stored before session records existed) are listed too.
 */
export function toSessionRows(sessions: Session[], messages: StreamMessage[], muted: ReadonlySet<string>): SessionRow[] {
  const rows = new Map<string, SessionRow>()
  for (const s of sessions)
    rows.set(s.id, { id: s.id, ...splitSessionName(s.name), lastSeenAt: s.lastSeenAt, muted: muted.has(s.id), ended: s.endedAt != null })
  for (const m of messages) {
    const row = rows.get(m.sessionId)
    if (!row)
      rows.set(m.sessionId, { id: m.sessionId, ...splitSessionName(m.sessionName), lastSeenAt: m.at, muted: muted.has(m.sessionId), ended: false })
    else if (m.at > row.lastSeenAt)
      row.lastSeenAt = m.at
  }
  return [...rows.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt)
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

export function useMutedSessions() {
  function toggleMute(id: string) {
    const next = new Set(muted.value)
    if (!next.delete(id))
      next.add(id)
    muted.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    }
    catch {}
  }
  return { muted, toggleMute }
}
