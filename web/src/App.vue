<script setup lang="ts">
import type { TriageEngine } from '../../src/shared/types'
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { cellKeys, toArtifacts } from './artifacts'
import { useCaptures } from './captures'
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
import { activePin } from './components/stream/follow'
import { usePin } from './pin'
import { inScope, toSessionRows, useMutedSessions } from './sessions'
import { putServerSettings, useSettings } from './settings'
import { useTheme } from './theme'
import { useStream } from './useStream'

const { messages, sessions, feedback, triage, settings: serverSettings, arrivals, connected, restored } = useStream()
const { preference, setTheme, toggleTheme } = useTheme()
const { muted, toggleMute } = useMutedSessions()
const { toast } = useToast()

// Session scope; muted sessions are hidden in every scope
const scope = ref<string | null>(null)
const sessionRows = computed(() => toSessionRows(sessions.value, messages.value, muted.value))
const scopeLabel = computed(() => sessions.value.find(s => s.id === scope.value)?.name ?? '전체 세션')
const visible = computed(() => inScope(messages.value, scope.value, muted.value))
// Earlier captures of the same screen hide behind the newest; 「따로 보기」 takes one out
const { split, cellOf, cellKey } = useCaptures()
const artifacts = computed(() => toArtifacts(messages.value, visible.value, split.value))
// Images the sessions only looked at: folded away, numbered and counted nowhere
const references = computed(() => toArtifacts(messages.value, visible.value, split.value, 'reference'))
watchEffect(() => cellOf.value = cellKeys([...artifacts.value, ...references.value]))

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
async function setEngine(engine: TriageEngine) {
  try {
    // The server broadcasts the change too, so every open view follows
    serverSettings.value = await putServerSettings({ ...serverSettings.value, triage: engine })
    toast(engine === 'off' ? '대화 정리를 껐어요' : '대화 정리를 켰어요. 새 메시지부터 적용돼요')
  }
  catch (error) {
    toast((error as Error).message)
  }
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
const { openKey: viewerKey, open, openCell } = useImageViewer()
// A reference opens among the references, so artifacts keep their own numbering there
const viewerItems = computed(() => references.value.some(r => r.key === viewerKey.value) ? references.value : artifacts.value)

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
// A pinned cell holds the rail; the pin survives a reload while its cell is still there
const { pinned, setPin } = usePin()
watch(artifacts, (list) => {
  // Before the server's hello the list is empty, not missing the pinned cell
  if (!messages.value.length || !pinned.value)
    return
  // A cell that left the rail (a new scope, a muted session, gone) lets go of its pin
  if (!activePin(pinned.value, new Set(list.map(a => a.key))))
    setPin(null)
  // A restored pin comes back selected, as it was left
  else selected.value ??= pinned.value
}, { immediate: true })
// Esc lets go of the pin, unless it already closed something (overlays prevent default,
// and run first on document) or is meant for a text field
function unpinOnEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || viewerKey.value || !pinned.value)
    return
  if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input, textarea, select')))
    return
  setPin(null)
}
onMounted(() => window.addEventListener('keydown', unpinOnEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', unpinOnEscape))

function onThumb(key: string) {
  // Mobile has no stream surface: a thumbnail opens the viewer directly
  if (matchMedia('(max-width: 767px)').matches) {
    open(key)
    return
  }
  // The thumbnail's capture may sit behind a newer one: pick the cell that shows it
  selected.value = cellKey(key)
  stream.value?.reveal(selected.value)
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
        ref="stream" :artifacts="artifacts" :references="references" :selected="selected" :pinned="pinned" :scope="scope" :all-muted="allMuted"
        @select="select" @pin="setPin" @open="openCell" @sessions="sessionsOpen = true"
      />
      <ChatPanel
        ref="chat" :messages="visible" :sessions="sessions" :offline="notices.chatNote" :selected="selected" :selected-message="selectedMessage"
        :feedback="feedback" :scoped="scope != null" :scope="scope" :scope-muted="scope != null && muted.has(scope)" :all-muted="allMuted"
        :engine="serverSettings.triage" :triage="triage" :arrivals="arrivals"
        @thumb="onThumb" @sessions="sessionsOpen = true" @scope="pickScope" @mute="mute"
      />
    </main>
    <SettingsSheet
      v-if="settingsOpen" :settings="settings" :theme="preference" :engine="serverSettings.triage"
      @close="settingsOpen = false" @save="saveSettings" @update:theme="setTheme" @update:engine="setEngine"
    />
    <ImageViewer v-if="viewerKey" v-model="viewerKey" :items="viewerItems" />
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
