<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toArtifacts } from './artifacts'
import { resolveNotices } from './components/banner/notices'
import AppBar from './components/shell/AppBar.vue'
import ChatPanel from './components/shell/ChatPanel.vue'
import EmptyState from './components/shell/EmptyState.vue'
import StreamPanel from './components/shell/StreamPanel.vue'
import { useTheme } from './theme'
import { useStream } from './useStream'

const { messages, sessions, connected, restored } = useStream()
const { toggleTheme } = useTheme()

// Session scope. The session menu that changes it lands with the overlay components (#17).
const scope = ref<string | null>(null)
const scopeLabel = computed(() => sessions.value.find(s => s.id === scope.value)?.name ?? '전체 세션')
const visible = computed(() => scope.value ? messages.value.filter(m => m.sessionId === scope.value) : messages.value)
const artifacts = computed(() => toArtifacts(visible.value))

// 「다시 연결 중」 only after a connection dropped, or when the first one is slow,
// so a normal page load does not flash it
const everConnected = ref(false)
const graceOver = ref(false)
watch(connected, (c) => {
  if (c)
    everConnected.value = true
})
onMounted(() => setTimeout(() => graceOver.value = true, 2000))
const offline = computed(() => !connected.value && (everConnected.value || graceOver.value))

// First-connection guide once the server's hello says there is nothing yet
const ready = ref(false)
watch(messages, () => ready.value = true, { once: true })
const showEmpty = computed(() => !messages.value.length && (ready.value || graceOver.value))

// One notice per area; the setup guide silences the rest (OD banner guide 08).
// AppBar still draws only 「다시 연결 중」: 「다시 연결됐어요」 shows once it adopts ConnectionChip.
const notices = computed(() => resolveNotices({
  setup: showEmpty.value,
  connection: offline.value ? 'offline' : restored.value ? 'restored' : 'online',
}))

// Selection links a cell, its chat thumbnail, and its message
const selected = ref<string | null>(null)
const selectedMessage = computed(() => artifacts.value.find(a => a.key === selected.value)?.messageId ?? null)
const stream = ref<InstanceType<typeof StreamPanel>>()
const chat = ref<InstanceType<typeof ChatPanel>>()

function select(key: string) {
  selected.value = key
  if (selectedMessage.value != null)
    chat.value?.reveal(selectedMessage.value)
}
function onThumb(key: string) {
  // Mobile has no stream surface: a thumbnail opens the viewer directly
  if (matchMedia('(max-width: 767px)').matches) {
    open(key)
    return
  }
  selected.value = key
  stream.value?.reveal(key)
}

// Interim viewer; the full viewer comes with the overlay components (#17)
const viewer = ref<string | null>(null)
function open(key: string) {
  viewer.value = artifacts.value.find(a => a.key === key)?.url ?? null
}
</script>

<template>
  <div class="app">
    <!-- Session menu and settings sheet are stubs until #17 -->
    <AppBar :offline="notices.chip === 'offline'" :scope-label="scopeLabel" :show-session-button="!showEmpty" @theme="toggleTheme" />
    <EmptyState v-if="showEmpty" :connected="connected" />
    <main v-else-if="messages.length" class="workspace">
      <StreamPanel ref="stream" :artifacts="artifacts" :selected="selected" @select="select" @open="open" />
      <ChatPanel
        ref="chat" :messages="visible" :offline="notices.chatNote" :selected="selected" :selected-message="selectedMessage"
        @thumb="onThumb"
      />
    </main>
    <div v-if="viewer" class="viewer" @click="viewer = null">
      <img :src="viewer" alt="">
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100dvh;
  min-height: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 18px 18px;
}
.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 440px;
  gap: 16px;
}

.viewer {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 24px;
  background: oklch(0 0 0 / 0.85);
  cursor: zoom-out;
}
.viewer img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  touch-action: pinch-zoom;
}

/* Tablet: stream on top, chat below */
@media (min-width: 768px) and (max-width: 1023px) {
  .app {
    padding: 0 14px 14px;
  }
  .workspace {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .workspace > .stream-panel {
    height: 43%;
    flex: none;
  }
  .workspace > .chat-panel {
    flex: 1;
  }
}

/* Mobile: chat only, full bleed */
@media (max-width: 767px) {
  .app {
    min-height: 400px;
    padding: 0;
  }
  .workspace {
    display: block;
  }
  .workspace > .chat-panel {
    height: 100%;
  }
}
</style>
