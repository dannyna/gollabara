<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toArtifacts } from './artifacts'
import { resolveNotices } from './components/banner/notices'
import AppToast from './components/overlay/AppToast.vue'
import ImageViewer from './components/overlay/ImageViewer.vue'
import SessionPopover from './components/overlay/SessionPopover.vue'
import SettingsSheet from './components/overlay/SettingsSheet.vue'
import { useImageViewer } from './components/overlay/useImageViewer'
import { useToast } from './components/overlay/useToast'
import AppBar from './components/shell/AppBar.vue'
import ChatPanel from './components/shell/ChatPanel.vue'
import EmptyState from './components/shell/EmptyState.vue'
import StreamPanel from './components/shell/StreamPanel.vue'
import { inScope, toSessionRows, useMutedSessions } from './sessions'
import { useSettings } from './settings'
import { useTheme } from './theme'
import { useStream } from './useStream'

const { messages, sessions, connected, restored } = useStream()
const { preference, setTheme, toggleTheme } = useTheme()
const { muted, toggleMute } = useMutedSessions()
const { toast } = useToast()

// Session scope; muted sessions are hidden in every scope
const scope = ref<string | null>(null)
const sessionRows = computed(() => toSessionRows(sessions.value, messages.value, muted.value))
const scopeLabel = computed(() => sessions.value.find(s => s.id === scope.value)?.name ?? '전체 세션')
const visible = computed(() => inScope(messages.value, scope.value, muted.value))
const artifacts = computed(() => toArtifacts(visible.value))

const appBar = ref<InstanceType<typeof AppBar>>()
const sessionsOpen = ref(false)
function pickScope(id: string | null) {
  scope.value = id
  sessionsOpen.value = false
}
function mute(id: string) {
  toggleMute(id)
  // Never leave the scope on a session just muted
  if (muted.value.has(id) && scope.value === id)
    scope.value = null
}

const settingsOpen = ref(false)
const { settings, save } = useSettings()
function saveSettings(next: typeof settings.value) {
  save(next)
  settingsOpen.value = false
  toast('이 브라우저에 설정을 저장했어요')
}

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

// Every session muted: the stream says so and points back to the session menu
const allMuted = computed(() => sessionRows.value.length > 0 && sessionRows.value.every(s => s.muted))

// One notice per area; the setup guide silences the rest (OD banner guide 08)
const notices = computed(() => resolveNotices({
  setup: showEmpty.value,
  connection: offline.value ? 'offline' : restored.value ? 'restored' : 'online',
  streamEmpty: !artifacts.value.length,
}))

// The viewer opens from anywhere through useImageViewer (stream cells, chat thumbnails)
const { openKey: viewerKey, open } = useImageViewer()

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
</script>

<template>
  <div class="app">
    <AppBar
      ref="appBar" :connection="notices.chip" :scope-label="scopeLabel" :show-session-button="!showEmpty"
      :sessions-open="sessionsOpen" @sessions="sessionsOpen = !sessionsOpen" @theme="toggleTheme"
      @settings="settingsOpen = true"
    >
      <template #sessions>
        <SessionPopover
          v-if="sessionsOpen" :sessions="sessionRows" :scope="scope" :anchor="() => appBar?.sessionButton"
          @close="sessionsOpen = false" @select="pickScope" @mute="mute"
        />
      </template>
    </AppBar>
    <EmptyState v-if="showEmpty" :connected="connected" />
    <main v-else-if="messages.length" class="workspace">
      <StreamPanel
        ref="stream" :artifacts="artifacts" :selected="selected" :scoped="scope != null" :all-muted="allMuted"
        @select="select" @open="open" @sessions="sessionsOpen = true"
      />
      <ChatPanel
        ref="chat" :messages="visible" :sessions="sessions" :offline="notices.chatNote" :selected="selected" :selected-message="selectedMessage"
        :scoped="scope != null" :scope-muted="scope != null && muted.has(scope)" :all-muted="allMuted"
        @thumb="onThumb" @sessions="sessionsOpen = true"
      />
    </main>
    <SettingsSheet
      v-if="settingsOpen" :settings="settings" :theme="preference"
      @close="settingsOpen = false" @save="saveSettings" @update:theme="setTheme"
    />
    <ImageViewer v-if="viewerKey" v-model="viewerKey" :items="artifacts" />
    <AppToast />
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
