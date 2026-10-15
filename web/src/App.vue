<script setup lang="ts">
import type { TriageEngine } from '../../src/shared/types'
import type { Settings } from './settings'
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { cellKeys, toArtifacts } from './artifacts'
import { useCaptures } from './captures'
import { resolveNotices } from './components/banner/notices'
import StateView from './components/banner/StateView.vue'
import AppToast from './components/overlay/AppToast.vue'
import ConfirmDialog from './components/overlay/ConfirmDialog.vue'
import ImageViewer from './components/overlay/ImageViewer.vue'
import SessionPopover from './components/overlay/SessionPopover.vue'
import SettingsSheet from './components/overlay/SettingsSheet.vue'
import { useFeedbackTarget } from './components/overlay/useFeedbackTarget'
import { useImageViewer } from './components/overlay/useImageViewer'
import { useToast } from './components/overlay/useToast'
import AppBar from './components/shell/AppBar.vue'
import ChatPanel from './components/shell/ChatPanel.vue'
import EmptyState from './components/shell/EmptyState.vue'
import StreamPanel from './components/shell/StreamPanel.vue'
import { activePin } from './components/stream/follow'
import { usePin } from './pin'
import { usePush } from './push'
import { deleteSessionData, endedSessions, inScope, toSessionRows, useMutedSessions } from './sessions'
import { forgetLegacyRetention, migrateLocalSettings, putServerSettings, sheetSettings, shortensRetention, useSettings } from './settings'
import { useTheme } from './theme'
import { useStream } from './useStream'

const { messages, sessions, feedback, triage, settings: serverSettings, arrivals, connected, offline, restored } = useStream()
const { preference, setTheme, toggleTheme } = useTheme()
const { muted, toggleMute } = useMutedSessions()
const { toast } = useToast()

// Session scope; muted sessions are hidden in every scope
const scope = ref<string | null>(null)
const sessionRows = computed(() => toSessionRows(sessions.value, messages.value, muted.value))
const scopeLabel = computed(() => sessions.value.find(s => s.id === scope.value)?.name ?? '전체 세션')
const visible = computed(() => inScope(messages.value, scope.value, muted.value))
const ended = computed(() => endedSessions(sessions.value))
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
// The server address stays in this browser; the rest comes from the server, so every device agrees
const { server, saveServer } = useSettings()
const settings = computed(() => sheetSettings(server.value, serverSettings.value))
const RETENTION_LABEL = { 7: '7일', 30: '30일', forever: '계속 보관' } as const
/** A save that shortens retention, waiting for 「줄이고 지우기」 */
const shortening = ref<Settings | null>(null)
function saveSettings(next: Settings) {
  if (shortensRetention(settings.value.retention, next.retention))
    shortening.value = next
  else
    commitSettings(next)
}
async function commitSettings(next: Settings) {
  shortening.value = null
  saveServer(next.server)
  const prev = settings.value
  // Only what changed, so this device's copy never overwrites another device's newer choice
  const patch = {
    ...(next.phone !== prev.phone ? { phone: next.phone } : {}),
    ...(next.retention !== prev.retention ? { retention: next.retention } : {}),
  }
  try {
    if (Object.keys(patch).length)
      serverSettings.value = await putServerSettings(patch)
    settingsOpen.value = false
    toast('설정을 저장했어요')
  }
  catch (error) {
    toast((error as Error).message)
  }
}
async function setEngine(engine: TriageEngine) {
  try {
    // The server broadcasts the change too, so every open view follows
    serverSettings.value = await putServerSettings({ triage: engine })
    toast(engine === 'off' ? '대화 정리를 껐어요' : '대화 정리를 켰어요. 새 메시지부터 적용돼요')
  }
  catch (error) {
    toast((error as Error).message)
  }
}

// 「알림 받기」: the browser's subscription is the state, read again whenever the sheet opens
const { state: pushState, busy: pushBusy, refresh: refreshPush, set: setPushOn } = usePush()
watch(settingsOpen, open => open && refreshPush().catch(() => {}))
async function setPush(on: boolean) {
  try {
    await setPushOn(on)
    if (pushState.value === (on ? 'on' : 'off'))
      toast(on ? '이 기기에서 알림을 켰어요' : '이 기기에서 알림을 껐어요')
  }
  catch (error) {
    toast((error as Error).message)
  }
}

// 「다시 연결 중」 only once the connection has been down for 2 s (useStream), so a normal
// page load or a quick server restart does not flash it

// First-connection guide once the server's hello says there is nothing yet
const ready = ref(false)
watch(messages, () => ready.value = true, { once: true })
// Settings this browser kept from before the server stored them seed it once, after the first hello.
// A kept window that deletes (7 or 30 days) asks first, like any shorter window.
const legacyRetention = ref<'7' | '30' | null>(null)
watch(ready, async () => {
  legacyRetention.value = await migrateLocalSettings(serverSettings.value).catch(() => null)
}, { once: true })
async function seedRetention(ok: boolean) {
  const retention = legacyRetention.value
  legacyRetention.value = null
  if (ok && retention) {
    try {
      serverSettings.value = await putServerSettings({ retention, seed: true })
    }
    catch (error) {
      // Kept locally, so it asks again on the next load
      toast((error as Error).message)
      return
    }
  }
  forgetLegacyRetention()
}
const showEmpty = computed(() => !messages.value.length && ready.value)
// No hello yet and the server does not answer (the installed app opened offline): the shell
// says so instead of a blank stream
const unreachable = computed(() => !ready.value && offline.value)

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

// 「이 세션 데이터 삭제」 from an avatar menu, after the app's own confirmation
const deleting = ref<string | null>(null)
const deletingName = computed(() => deleting.value && (sessions.value.find(s => s.id === deleting.value)?.name
  ?? messages.value.find(m => m.sessionId === deleting.value)?.sessionName ?? deleting.value))
async function deleteSession() {
  const id = deleting.value
  deleting.value = null
  if (!id)
    return
  try {
    // The server's broadcast drops the rows from every open view, this one included
    await deleteSessionData(id)
    toast('세션 데이터를 지웠어요')
  }
  catch (error) {
    toast((error as Error).message)
  }
}
// Rows deleted anywhere (retention, another device) leave nothing pointing at them. The viewer
// closes and the pin lets go on their own once their cell is gone.
const { target, clearTarget } = useFeedbackTarget()
watch([messages, sessions], ([list, known]) => {
  const ids = new Set(list.map(m => m.id))
  if (selected.value && !ids.has(Number.parseInt(selected.value)))
    selected.value = null
  if (target.value && !list.some(m => m.images?.some(i => i.url === target.value!.imageUrl)))
    clearTarget()
  const exists = (id: string) => known.some(s => s.id === id) || list.some(m => m.sessionId === id)
  if (scope.value && !exists(scope.value))
    scope.value = null
})

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
    <StateView v-else-if="unreachable" icon="plug" title="서버에 연결할 수 없어요" description="다시 연결하는 중이에요. 서버가 돌아오면 바로 이어서 보여요." />
    <main v-else-if="messages.length" class="workspace">
      <StreamPanel
        ref="stream" :artifacts="artifacts" :references="references" :selected="selected" :pinned="pinned" :scope="scope" :all-muted="allMuted"
        :ended="ended" @select="select" @pin="setPin" @open="openCell" @sessions="sessionsOpen = true"
      />
      <ChatPanel
        ref="chat" :messages="visible" :sessions="sessions" :offline="notices.chatNote" :selected="selected" :selected-message="selectedMessage"
        :feedback="feedback" :scoped="scope != null" :scope="scope" :scope-muted="scope != null && muted.has(scope)" :all-muted="allMuted"
        :engine="serverSettings.triage" :triage="triage" :arrivals="arrivals"
        @thumb="onThumb" @sessions="sessionsOpen = true" @scope="pickScope" @mute="mute" @delete="deleting = $event"
      />
    </main>
    <SettingsSheet
      v-if="settingsOpen" :settings="settings" :theme="preference" :engine="serverSettings.triage"
      :push="pushState" :push-busy="pushBusy"
      @close="settingsOpen = false" @save="saveSettings" @update:theme="setTheme" @update:engine="setEngine" @update:push="setPush"
    />
    <ConfirmDialog
      v-if="shortening" :title="`보관 기간을 ${RETENTION_LABEL[shortening.retention]}로 줄일까요?`" confirm-label="줄이고 지우기" over-sheet
      @cancel="shortening = null" @confirm="commitSettings(shortening)"
    >
      <b>{{ RETENTION_LABEL[shortening.retention] }}보다 오래된</b> 메시지, 이미지, 피드백이 이 Mac에서 지워지고, 되돌릴 수 없어요.
    </ConfirmDialog>
    <ConfirmDialog
      v-else-if="legacyRetention" :title="`보관 기간을 ${RETENTION_LABEL[legacyRetention]}로 줄일까요?`" confirm-label="줄이고 지우기"
      @cancel="seedRetention(false)" @confirm="seedRetention(true)"
    >
      이 브라우저에 저장해 둔 보관 기간이에요. 이제 서버가 정말 지워요. <b>{{ RETENTION_LABEL[legacyRetention] }}보다 오래된</b> 메시지, 이미지, 피드백이 이 Mac에서 지워지고, 되돌릴 수 없어요. 취소하면 계속 보관해요.
    </ConfirmDialog>
    <ConfirmDialog
      v-if="deleting" :title="`${deletingName} 세션의 데이터를 지울까요?`" confirm-label="지우기"
      @cancel="deleting = null" @confirm="deleteSession"
    >
      이 세션의 메시지와 피드백, 다른 세션과 같이 쓰지 않는 이미지가 이 Mac에서 지워지고, 되돌릴 수 없어요.
    </ConfirmDialog>
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
