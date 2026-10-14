// 서버 WebSocket 에 붙어 스트림 메시지를 받는다. 끊기면 다시 붙는다.

import type { ServerFrame, StreamMessage } from '../../src/shared/types'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

const RETRY_MS = 2000

export function useStream() {
  const messages = shallowRef<StreamMessage[]>([])
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
      if (frame.type === 'hello')
        messages.value = frame.messages
      else
        messages.value = [...messages.value, frame.message]
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

  return { messages, connected }
}
