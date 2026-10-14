// Connects to the server WebSocket for stream messages. Reconnects when dropped.

import type { ServerFrame, Session, StreamMessage } from '../../src/shared/types'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

const RETRY_MS = 2000

export function useStream() {
  const messages = shallowRef<StreamMessage[]>([])
  const sessions = shallowRef<Session[]>([])
  const connected = ref(false)
  let ws: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let closed = false

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/ws`)
    ws.onopen = () => {
      connected.value = true
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
      connected.value = false
      if (!closed)
        timer = setTimeout(connect, RETRY_MS)
    }
  }

  onMounted(connect)
  onBeforeUnmount(() => {
    closed = true
    clearTimeout(timer)
    ws?.close()
  })

  return { messages, sessions, connected }
}

/** Turn messages change in place as images and recaps arrive, so replace by id */
function upsert(list: StreamMessage[], message: StreamMessage): StreamMessage[] {
  const i = list.findIndex(m => m.id === message.id)
  return i === -1 ? [...list, message] : list.map((m, j) => j === i ? message : m)
}
