<script setup lang="ts">
import type { Feedback, Session, StreamMessage, Triage, TriageEngine } from '../../../../src/shared/types'
import type { PendingSend } from '../../feedback'
import type { Thumb } from '../chat/ArtifactThumbs.vue'
import type { SystemEvent } from '../chat/chat'
import type { ComposerAttachment, ComposerSend } from '../chat/ChatComposer.vue'
import type { QueueGroup } from '../chat/QueueTray.vue'
import type { MentionOption } from '../overlay/MentionList.vue'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { artifactKey, clock, splitSessionName } from '../../artifacts'
import { failureReason, mergeFeedback, postFeedback, queueNote, resolveTarget, toMyEntries, VIA_LABEL } from '../../feedback'
import { toSessionRows, useMutedSessions } from '../../sessions'
import { shownKeys, triageView } from '../../triage'
import NewPill from '../banner/NewPill.vue'
import NoticeLine from '../banner/NoticeLine.vue'
import StateView from '../banner/StateView.vue'
import ArtifactThumbs from '../chat/ArtifactThumbs.vue'
import { toFeed, toTimeline } from '../chat/chat'
import ChatComposer from '../chat/ChatComposer.vue'
import DateLabel from '../chat/DateLabel.vue'
import HiddenRow from '../chat/HiddenRow.vue'
import MyMessage from '../chat/MyMessage.vue'
import QuestionCard from '../chat/QuestionCard.vue'
import QueueTray from '../chat/QueueTray.vue'
import RecapLine from '../chat/RecapLine.vue'
import SessionMessage from '../chat/SessionMessage.vue'
import SessionStarts from '../chat/SessionStarts.vue'
import SystemLine from '../chat/SystemLine.vue'
import MentionList from '../overlay/MentionList.vue'
import { useFeedbackTarget } from '../overlay/useFeedbackTarget'
import { useImageViewer } from '../overlay/useImageViewer'

const props = defineProps<{
  messages: StreamMessage[]
  /** For the 「… 시작」 lines */
  sessions?: Session[]
  /** Lost the server: the notice line shows, questions lock, sending is blocked */
  offline?: boolean
  /** Key of the selected artifact, to mark its thumbnail */
  selected?: string | null
  /** Message the selected artifact belongs to, to highlight it */
  selectedMessage?: number | null
  /** The user's feedback to every session, from useStream */
  feedback?: Feedback[]
  /** Viewing one session rather than 「전체 세션」 */
  scoped?: boolean
  /** The session in view, when scoped; it is the default receiver */
  scope?: string | null
  /** The scope is a muted session (unreachable today: muting the scope resets it) */
  scopeMuted?: boolean
  /** Every session is muted, so nothing is in view */
  allMuted?: boolean
  /** Server triage engine; 'off' (the default) shows the chat exactly as it arrived */
  engine?: TriageEngine
  /** Verdicts by triageKey */
  triage?: ReadonlyMap<string, Triage>
  /** When recap lines arrived live, so new ones can wait briefly for a verdict */
  arrivals?: ReadonlyMap<string, number>
}>()
const emit = defineEmits<{
  thumb: [key: string]
  /** A paired thumbnail pressed again; it also opens the image viewer */
  openImage: [image: Thumb]
  /** Open the session menu */
  sessions: []
}>()

// Answering questions is not built yet: question cards are drawn inert.

const feed = ref<HTMLElement>()
const nameOf = (id: string) => props.sessions?.find(s => s.id === id)?.name ?? props.messages.find(m => m.sessionId === id)?.sessionName ?? id
const shortName = (id: string) => splitSessionName(nameOf(id)).session

// Mute is a client filter with no history, so its lines exist only for changes made
// while this page is open, and only in 「전체 세션」 (OD chat guide 05)
const { muted } = useMutedSessions()
const muteEvents = ref<SystemEvent[]>([])
watch(muted, (next, prev) => {
  const at = Date.now()
  for (const id of next) {
    if (!prev.has(id))
      muteEvents.value.push({ key: `mute-${id}-${at}`, at, icon: 'mute', text: `${nameOf(id)} 음소거함` })
  }
  for (const id of prev) {
    if (!next.has(id))
      muteEvents.value.push({ key: `unmute-${id}-${at}`, at, icon: 'sound', text: `${nameOf(id)} 음소거 해제` })
  }
})
// Feedback follows the same view rules as messages: never a muted session, only the scope
const inView = (sessionId: string) => !muted.value.has(sessionId) && (props.scope == null || sessionId === props.scope)
// POST responses, merged so a bubble never waits on the WebSocket frame
const confirmed = shallowRef<Feedback[]>([])
const pending = ref<PendingSend[]>([])
const feedback = computed(() => confirmed.value.reduce(mergeFeedback, props.feedback ?? []).filter(f => inView(f.sessionId)))
const mine = computed(() => toMyEntries(feedback.value, pending.value.filter(p => inView(p.request.sessionId))))

// Triage: hidden lines fold into 「숨긴 메시지 n」 rows in place; a new recap-only line waits up
// to HOLD_MS (10 s) for its verdict. Lines already drawn are remembered (not reactive: it is
// read on the recompute a verdict triggers), so a late hide dims a line instead of pulling it.
const seen = new Set<string>()
const now = ref(Date.now())
const view = computed(() => triageView(props.messages, {
  engine: props.engine ?? 'off',
  triage: props.triage ?? new Map(),
  arrivals: props.arrivals,
  now: now.value,
  seen,
}))
watch(view, v => shownKeys(v).forEach(key => seen.add(key)), { immediate: true })
/** Open 「숨긴 메시지 n」 rows, by row key */
const openRows = ref(new Set<string>())
function toggleRow(key: string, open: boolean) {
  const next = new Set(openRows.value)
  if (open)
    next.add(key)
  else
    next.delete(key)
  openRows.value = next
}
let holdTimer: ReturnType<typeof setTimeout> | undefined
watch(() => view.value.nextCheck, (at) => {
  clearTimeout(holdTimer)
  if (at != null)
    holdTimer = setTimeout(() => now.value = Date.now(), Math.max(0, at - Date.now()) + 20)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(holdTimer))
const shown = computed(() => view.value.items.filter(i => !i.folded).map(i => i.message))
const viewOf = computed(() => new Map(view.value.items.map(i => [i.message.id, i])))
// Folded messages keep their place in the timeline so their rows land where the lines were
const timeline = computed(() => toFeed(
  toTimeline(view.value.items.map(i => i.message), props.sessions, props.scoped ? [] : muteEvents.value, Date.now(), mine.value),
  (m) => {
    const v = viewOf.value.get(m.id)
    return v?.folded ? v.parts.flatMap(p => p.type === 'hidden' ? p.lines : []) : null
  },
))

// Queued on the server, not yet picked up: the tray, one group per session
const queue = computed<QueueGroup[]>(() => {
  const groups = new Map<string, QueueGroup>()
  for (const f of feedback.value) {
    if (f.deliveredAt != null)
      continue
    let group = groups.get(f.sessionId)
    if (!group)
      groups.set(f.sessionId, group = { session: shortName(f.sessionId), items: [] })
    group.items.push(f.image ? `↪ 이미지 · ${f.text}` : f.text)
  }
  return [...groups.values()]
})
// 「바로 전달돼요」 only when every waiting session has a live wake-up hook
const queueTrayNote = computed(() => queueNote(
  [...new Set(feedback.value.filter(f => f.deliveredAt == null).map(f => f.sessionId))],
  props.sessions ?? [],
))

// Chat thumbnails open the one app viewer at every width
const { open } = useImageViewer()
function openImage(image: Thumb) {
  open(image.key)
  emit('openImage', image)
}

// The viewer's 「이 이미지에 피드백 ↗」 sets the target; the composer shows it as its chip
const { target, clearTarget } = useFeedbackTarget()
const attachment = computed<ComposerAttachment | null>(() => target.value && {
  url: target.value.imageUrl,
  session: nameOf(target.value.sessionId),
  caption: target.value.caption ?? clock(target.value.at),
})
function onAttachment(next: ComposerAttachment | null) {
  if (!next)
    clearTarget()
}
const composer = ref<InstanceType<typeof ChatComposer>>()
// Post-flush, after the viewer closed and handed focus back to its opener
watch(target, async (next) => {
  if (!next)
    return
  await nextTick()
  composer.value?.focus()
}, { flush: 'post' })

// @세션: the list opens from the button or a typed `@`, and never offers a muted session
const mentioned = ref<string | null>(null)
const mentionQuery = ref<string | null>(null)
const mentionButton = ref(false)
const mentionList = ref<InstanceType<typeof MentionList>>()
const mentionOptions = computed<MentionOption[]>(() => {
  const q = mentionQuery.value?.toLowerCase() ?? ''
  return toSessionRows(props.sessions ?? [], props.messages, muted.value)
    .filter(r => !r.muted && r.session.toLowerCase().includes(q))
    .map(r => ({ id: r.id, session: r.session, branch: r.branch }))
})
const mentionOpen = computed(() => (mentionButton.value || mentionQuery.value != null) && mentionOptions.value.length > 0)
function closeMention() {
  mentionButton.value = false
  mentionQuery.value = null
}
function pickMention(id: string) {
  mentioned.value = id
  closeMention()
  composer.value?.pickedMention()
}

const receiver = computed(() => resolveTarget({ attachment: target.value?.sessionId, scope: props.scope, mention: mentioned.value, muted: muted.value }))
const blocked = computed(() => props.offline
  ? { icon: 'plug' as const, text: '다시 연결되면 보낼 수 있어요' }
  : receiver.value == null ? { icon: 'alert' as const, text: '@로 보낼 세션을 골라 주세요' } : undefined)

let sendSeq = 0
async function deliver(p: PendingSend) {
  try {
    const saved = await postFeedback(p.request)
    confirmed.value = [...confirmed.value, saved]
    pending.value = pending.value.filter(x => x.key !== p.key)
  }
  catch (error) {
    pending.value = pending.value.map(x => x.key === p.key ? { ...x, state: 'failed', reason: failureReason(error) } : x)
  }
}
function send({ text }: ComposerSend) {
  const sessionId = receiver.value
  if (sessionId == null)
    return
  const image = target.value
  // Captured now, so a retry goes where the first try went
  const p: PendingSend = {
    key: `p-${++sendSeq}`,
    request: { sessionId, text, ...(image ? { image: image.imageUrl } : {}) },
    quote: image ? { text: `${shortName(image.sessionId)} · ${image.caption ?? clock(image.at)}`, image: image.imageUrl } : undefined,
    at: Date.now(),
    state: 'queued',
  }
  pending.value = [...pending.value, p]
  clearTarget()
  void deliver(p)
  nextTick(jumpToLatest)
}
function retry(p: PendingSend) {
  pending.value = pending.value.map(x => x.key === p.key ? { ...x, state: 'queued', reason: undefined } : x)
  void deliver(p)
}
const thumbs = (m: StreamMessage) => (m.images ?? []).map((img, i) => ({ key: artifactKey(m.id, i), ...img }))

// Stick to the bottom only when the reader is already there. Otherwise count what
// arrives and raise 「새 메시지 n ↓」 instead of moving the reader.
const unseen = ref(0)
const isAtEnd = (el: HTMLElement) => el.scrollHeight - el.clientHeight - el.scrollTop < 70
let first = true
// Server ids only grow and upserts keep theirs, so only ids past the highest seen are new.
// Scope changes and unmuting show older messages; those are not counted. Watching what is
// shown means a held line counts when it appears, and a folded message never does.
let lastId = -Infinity
watch(shown, async (list) => {
  const arrived = list.filter(m => m.id > lastId).length
  lastId = Math.max(lastId, ...list.map(m => m.id))
  const el = feed.value
  const atEnd = !el || isAtEnd(el)
  await nextTick()
  if (first || atEnd)
    feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: first ? 'instant' : 'smooth' })
  else
    unseen.value += arrived
  if (props.messages.length)
    first = false
}, { immediate: true })
// A bubble turning delivered moves to the session's receive time; follow it when at the end
watch(() => mine.value.length, async () => {
  if (!feed.value || !isAtEnd(feed.value))
    return
  await nextTick()
  feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' })
})
function onScroll() {
  if (feed.value && isAtEnd(feed.value))
    unseen.value = 0
}
function jumpToLatest() {
  feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' })
  feed.value?.focus({ preventScroll: true })
  unseen.value = 0
}

/** Scrolls the message linked to the selected artifact into view */
function reveal(messageId: number) {
  feed.value?.querySelector(`[data-msg="${messageId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
defineExpose({ reveal })
</script>

<template>
  <section class="chat-panel" aria-label="세션 대화">
    <div class="heading">
      <h2>세션 대화</h2>
      <div class="heading-end">
        <span>질문에 답하고, 피드백을 남겨요</span>
      </div>
    </div>
    <NoticeLine v-if="offline">
      연결을 기다리는 중이에요. 이전 대화는 계속 볼 수 있어요.
    </NoticeLine>
    <StateView v-if="scopeMuted" title="음소거한 세션이에요." description="세션 목록에서 다시 표시할 수 있어요." />
    <StateView
      v-else-if="allMuted" title="모든 세션을 음소거했어요" description="세션 목록에서 다시 표시할 수 있어요."
      action="세션 목록 열기" @action="emit('sessions')"
    />
    <div v-else class="feed-box">
      <div ref="feed" class="feed" role="log" aria-label="세션 메시지" tabindex="-1" @scroll.passive="onScroll">
        <template v-for="item in timeline" :key="item.key">
          <DateLabel v-if="item.type === 'date'" :label="item.label" />
          <SystemLine v-else-if="item.type === 'system'" :icon="item.icon" :text="item.text" />
          <SessionStarts v-else-if="item.type === 'starts'" :rows="item.rows" :lead="item.lead" />
          <HiddenRow
            v-else-if="item.type === 'hidden'" :lines="item.lines"
            :model-value="openRows.has(item.key)" @update:model-value="toggleRow(item.key, $event)"
          />
          <MyMessage
            v-else-if="item.type === 'mine'" :target="shortName(item.entry.sessionId)" :text="item.entry.text"
            :quote="item.entry.quote" :state="item.entry.state" :at="item.entry.deliveredAt"
            :via="item.entry.via && VIA_LABEL[item.entry.via]" :reason="item.entry.pending?.reason"
            @retry="item.entry.pending && retry(item.entry.pending)"
          />
          <SessionMessage
            v-else :name="item.message.sessionName" :at="item.message.at"
            :highlighted="selectedMessage === item.message.id" :data-msg="item.message.id"
          >
            <template v-for="part in viewOf.get(item.message.id)?.parts" :key="part.type === 'line' ? part.line.index : part.key">
              <RecapLine
                v-if="part.type === 'line'" :text="part.line.text" :tone="part.line.tone"
                :filled="part.line.filled" :weak="part.line.weak"
              />
              <HiddenRow
                v-else inset :lines="part.lines"
                :model-value="openRows.has(part.key)" @update:model-value="toggleRow(part.key, $event)"
              />
            </template>
            <ArtifactThumbs
              v-if="item.message.images?.length" :thumbs="thumbs(item.message)" :tool-name="item.message.toolName"
              :active="selected" @pick="$emit('thumb', $event)" @open-image="openImage"
            />
            <!-- Answering is not built yet; with several questions every card shows at once -->
            <QuestionCard
              v-for="(q, qi) in item.message.questions" :key="`q${qi}`" :question="q" inert
              :state="offline ? 'offline' : 'open'"
              :count="item.message.questions!.length > 1 ? `${qi + 1} / ${item.message.questions!.length}` : undefined"
            />
          </SessionMessage>
        </template>
      </div>
      <!-- Nothing arrives while offline, so no pill then (OD banner guide 08) -->
      <NewPill v-if="unseen && !offline" kind="message" :count="unseen" @click="jumpToLatest" />
    </div>
    <ChatComposer
      ref="composer" can-send hint="@세션을 부르거나, 산출물에 답장해 보세요" :blocked="blocked"
      :target="receiver && shortName(receiver)" :attachment="attachment" :mention-open="mentionOpen"
      @update:attachment="onAttachment" @send="send"
      @mention="mentionButton = !mentionButton" @mention-query="mentionQuery = $event"
      @mention-focus="mentionList?.focusFirst()" @mention-close="closeMention"
    >
      <template v-if="queue.length" #tray>
        <QueueTray :groups="queue" :note="queueTrayNote" :actions="false" />
      </template>
      <template v-if="mentionOpen" #popover>
        <MentionList ref="mentionList" :options="mentionOptions" @pick="pickMention" @close="closeMention(); composer?.focus()" />
      </template>
    </ChatComposer>
  </section>
</template>

<style scoped>
.chat-panel {
  min-width: 0;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  background: var(--surface);
  box-shadow: 0 8px 25px oklch(0 0 0 / 0.08);
}
.heading {
  height: 60px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 24px;
}
.heading h2 {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
}
.heading-end {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.heading span {
  font-size: 10px;
  color: var(--muted);
}
.feed-box {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.feed {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 22px 14px;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .chat-panel {
    border-radius: 20px;
  }
  .heading {
    height: auto;
    min-height: 42px;
  }
  .feed {
    padding: 0 26px 12px;
  }
}

@media (max-width: 767px) {
  .chat-panel {
    border-radius: 22px 22px 0 0;
  }
  .heading {
    height: auto;
    min-height: 40px;
    padding: 0 18px;
  }
  .heading h2 {
    font-size: 11px;
  }
  .heading span {
    font-size: 9px;
  }
  .feed {
    padding: 0 16px 8px;
  }
}
</style>
