// Connects to the server WebSocket for stream messages. Reconnects when dropped.

import type { ServerFrame, Session, StreamMessage } from '../../src/shared/types'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

const RETRY_MS = 2000
// How long 「다시 연결됐어요」 stays in the app bar (OD banner guide 02-03)
const RESTORED_MS = 3000

/** True for a moment after a connection that had dropped opens again */
export function restoredFlag(ms = RESTORED_MS) {
  const restored = ref(false)
  let dropped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  function stop() {
    clearTimeout(timer)
    restored.value = false
  }
  return {
    restored,
    opened() {
      if (!dropped)
        return
      dropped = false
      clearTimeout(timer)
      restored.value = true
      timer = setTimeout(() => restored.value = false, ms)
    },
    /** `wasOpen` is false for retries that never connected; they keep the earlier drop */
    closed(wasOpen: boolean) {
      if (wasOpen)
        dropped = true
      stop()
    },
    dispose: stop,
  }
}

export function useStream() {
  const messages = shallowRef<StreamMessage[]>([])
  const sessions = shallowRef<Session[]>([])
  const connected = ref(false)
  const flag = restoredFlag()
  let ws: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let closed = false

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/ws`)
    ws.onopen = () => {
      connected.value = true
      flag.opened()
    }
    ws.onmessage = (e) => {
      const frame = JSON.parse(e.data) as ServerFrame
      if (frame.type === 'hello') {
        messages.value = frame.messages
        sessions.value = frame.sessions
      }
      else if (frame.type === 'message' || frame.type === 'message-upsert') {
        messages.value = upsert(messages.value, frame.message)
      }
      else if (frame.type === 'session') {
        sessions.value = sessions.value.some(s => s.id === frame.session.id)
          ? sessions.value.map(s => s.id === frame.session.id ? frame.session : s)
          : [...sessions.value, frame.session]
      }
    }
    ws.onclose = () => {
      flag.closed(connected.value)
      connected.value = false
      if (!closed)
        timer = setTimeout(connect, RETRY_MS)
    }
  }

  onMounted(connect)
  onBeforeUnmount(() => {
    closed = true
    clearTimeout(timer)
    flag.dispose()
    ws?.close()
  })

  return { messages, sessions, connected, restored: flag.restored }
}

/** Turn messages change in place as images and recaps arrive, so replace by id */
function upsert(list: StreamMessage[], message: StreamMessage): StreamMessage[] {
  const i = list.findIndex(m => m.id === message.id)
  return i === -1 ? [...list, message] : list.map((m, j) => j === i ? message : m)
}
