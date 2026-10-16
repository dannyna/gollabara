// Connects to the server WebSocket for stream messages and feedback. Reconnects when dropped.

import type { Feedback, ServerFrame, ServerSettings, Session, StreamMessage, Triage } from '../../src/shared/types'
import type { Holds } from './answers'
import type { HistoryState } from './history'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { applyHold, holdsFrom } from './answers'
import { feedbackBySession, mergeFeedback, sortFeedback } from './feedback'
import { fetchPage, helloRun, initialHistory, joinFeedback, joinPage, joinTriage, PAGE_SIZE } from './history'
import { newLines, toTriageMap, triageKey } from './triage'

// First retry, doubled per failed attempt up to the cap, so a restarted server is back on screen within 5 s
const RETRY_MIN_MS = 500
const RETRY_MAX_MS = 4000
// A drop shorter than this (a server restart) shows nothing
const OFFLINE_GRACE_MS = 2000
// How long 「다시 연결됐어요」 stays in the app bar (OD banner guide 02-03)
const RESTORED_MS = 3000

/** Wait before reconnect attempt `attempt` (0 for the first retry after a drop) */
export function retryDelay(attempt: number): number {
  return Math.min(RETRY_MIN_MS * 2 ** Math.max(0, attempt), RETRY_MAX_MS)
}

/**
 * `offline` once the connection has been down for `graceMs`, the first load included, so a quick restart
 * never flashes it; `restored` for a moment after a connection that was shown offline opens again.
 */
export function connectionFlags(graceMs = OFFLINE_GRACE_MS, restoredMs = RESTORED_MS) {
  const offline = ref(false)
  const restored = ref(false)
  let grace: ReturnType<typeof setTimeout> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  function dispose() {
    clearTimeout(grace)
    clearTimeout(timer)
    grace = undefined
  }
  return {
    offline,
    restored,
    opened() {
      clearTimeout(grace)
      grace = undefined
      if (!offline.value)
        return
      offline.value = false
      clearTimeout(timer)
      restored.value = true
      timer = setTimeout(() => restored.value = false, restoredMs)
    },
    /** The connection is down: on load, and after each close or failed retry */
    closed() {
      clearTimeout(timer)
      restored.value = false
      if (offline.value || grace)
        return
      grace = setTimeout(() => {
        grace = undefined
        offline.value = true
      }, graceMs)
    },
    dispose,
  }
}

/** Turn messages change in place as images and recaps arrive, so replace by id */
export function upsert(list: StreamMessage[], message: StreamMessage): StreamMessage[] {
  const i = list.findIndex(m => m.id === message.id)
  return i === -1 ? [...list, message] : list.map((m, j) => j === i ? message : m)
}

/** A hello replaces the list after a reconnect; one id appears once, the latest copy winning */
export function dedupe(list: StreamMessage[]): StreamMessage[] {
  const byId = new Map(list.map(m => [m.id, m]))
  return byId.size === list.length ? list : [...byId.values()]
}

export function useStream() {
  const messages = shallowRef<StreamMessage[]>([])
  const sessions = shallowRef<Session[]>([])
  /** The user's feedback to sessions, in send order; ids move from queued to delivered */
  const feedback = shallowRef<Feedback[]>([])
  /** Verdicts by triageKey; older servers send none */
  const triage = shallowRef<Map<string, Triage>>(new Map())
  const settings = shallowRef<ServerSettings>({ triage: 'off' })
  /** Questions a session's `ask` hook holds for the app to answer, by questionId */
  const holds = shallowRef<Holds>(new Map())
  /** When recap lines arrived live while triage was on, so new ones can wait for a verdict */
  const arrivals = shallowRef<Map<string, number>>(new Map())
  const connected = ref(false)
  const flag = connectionFlags()
  /** The run of messages in view: whether more lie before it, and its pages (history.ts) */
  const history = shallowRef<HistoryState>(initialHistory())
  const patchHistory = (patch: Partial<HistoryState>) => history.value = { ...history.value, ...patch }
  let ws: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let closed = false

  function connect() {
    clearTimeout(timer)
    // A socket being replaced must not report its own close or frames
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = null
      ws.close()
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = ws = new WebSocket(`${proto}://${location.host}/ws`)
    socket.onopen = () => {
      attempt = 0
      connected.value = true
      flag.opened()
    }
    socket.onmessage = (e) => {
      const frame = JSON.parse(e.data) as ServerFrame
      if (frame.type === 'hello') {
        // The server's snapshot replaces the latest messages, so a reconnect never doubles one. Older
        // pages the run loaded stay.
        const run = helloRun(messages.value, dedupe(frame.messages), frame.older ?? false, history.value.older)
        const kept = run.messages !== frame.messages && messages.value.length > 0
        messages.value = dedupe(run.messages)
        patchHistory({ older: run.older })
        sessions.value = frame.sessions
        // Older servers send no feedback
        feedback.value = kept ? joinFeedback(feedback.value, frame.feedback ?? []) : sortFeedback(frame.feedback ?? [])
        triage.value = kept ? joinTriage(triage.value, frame.triage ?? []) : toTriageMap(frame.triage ?? [])
        settings.value = frame.settings ?? { triage: 'off' }
        holds.value = holdsFrom(frame.holds)
      }
      else if (frame.type === 'hold') {
        holds.value = applyHold(holds.value, frame)
      }
      else if (frame.type === 'triage') {
        triage.value = new Map(triage.value).set(triageKey(frame.triage.messageId, frame.triage.index), frame.triage)
      }
      else if (frame.type === 'settings') {
        settings.value = frame.settings
      }
      else if (frame.type === 'deleted') {
        const gone = new Set(frame.messageIds)
        const feedbackGone = new Set(frame.feedbackIds)
        const sessionsGone = new Set(frame.sessionIds)
        messages.value = messages.value.filter(m => !gone.has(m.id))
        feedback.value = feedback.value.filter(f => !feedbackGone.has(f.id))
        sessions.value = sessions.value.filter(s => !sessionsGone.has(s.id))
        triage.value = new Map([...triage.value].filter(([, t]) => !gone.has(t.messageId)))
      }
      else if (frame.type === 'feedback') {
        feedback.value = mergeFeedback(feedback.value, frame.feedback)
      }
      else if (frame.type === 'message' || frame.type === 'message-upsert') {
        if (settings.value.triage !== 'off') {
          const fresh = newLines(messages.value.find(m => m.id === frame.message.id), frame.message)
          if (fresh.length) {
            const next = new Map(arrivals.value)
            for (const key of fresh) next.set(key, Date.now())
            arrivals.value = next
          }
        }
        messages.value = upsert(messages.value, frame.message)
      }
      else if (frame.type === 'session') {
        sessions.value = sessions.value.some(s => s.id === frame.session.id)
          ? sessions.value.map(s => s.id === frame.session.id ? frame.session : s)
          : [...sessions.value, frame.session]
      }
    }
    socket.onclose = () => {
      ws = null
      connected.value = false
      flag.closed()
      if (!closed)
        timer = setTimeout(connect, retryDelay(attempt++))
    }
  }

  // Back to the page, the network, or a page restored from the back-forward cache: retry now instead of
  // waiting out the backoff (a phone app returning from the background lands here)
  function wake() {
    if (closed || document.visibilityState === 'hidden')
      return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))
      return
    attempt = 0
    connect()
  }

  /** Extends the run back by one page */
  async function loadOlder() {
    const first = messages.value[0]
    if (history.value.loading || !first || !history.value.older)
      return
    patchHistory({ loading: true })
    try {
      const p = await fetchPage(first.id, PAGE_SIZE)
      triage.value = joinTriage(triage.value, p.triage)
      feedback.value = joinFeedback(feedback.value, p.feedback)
      messages.value = joinPage(messages.value, p.messages)
      patchHistory({ older: p.older, pages: history.value.pages + 1 })
    }
    finally {
      patchHistory({ loading: false })
    }
  }

  onMounted(() => {
    flag.closed()
    connect()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('pageshow', wake)
  })
  onBeforeUnmount(() => {
    closed = true
    clearTimeout(timer)
    flag.dispose()
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('online', wake)
    window.removeEventListener('pageshow', wake)
    if (ws)
      ws.onclose = null
    ws?.close()
  })

  return { messages, sessions, feedback, feedbackBySession: computed(() => feedbackBySession(feedback.value)), triage, settings, holds, arrivals, connected, offline: flag.offline, restored: flag.restored, history, loadOlder }
}
