<script setup lang="ts">
import type { Feedback, Session, StreamMessage, Triage, TriageEngine } from '../../../../src/shared/types'
import type { PendingSend } from '../../feedback'
import type { Guide } from '../../firstrun'
import type { HistoryState } from '../../history'
import type { Thumb } from '../chat/ArtifactThumbs.vue'
import type { SystemEvent } from '../chat/chat'
import type { ComposerAttachment, ComposerSend } from '../chat/ChatComposer.vue'
import type { QueueGroup } from '../chat/QueueTray.vue'
import type { MentionOption } from '../overlay/MentionList.vue'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { clock, splitSessionName } from '../../artifacts'
import { discardFeedback, ENDED_NOTE, failureReason, mergeFeedback, postFeedback, queueNote, resolveTarget, sessionRouteNote, toMyEntries, toQueueGroups, VIA_LABEL, withoutRemoved } from '../../feedback'
import { useNameHints } from '../../names'
import { endedSessions, muteChanges, toSessionRows, useMutedSessions } from '../../sessions'
import { shownKeys, triageView } from '../../triage'
import NewPill from '../banner/NewPill.vue'
import NoticeLine from '../banner/NoticeLine.vue'
import StateView from '../banner/StateView.vue'
import ArtifactThumbs from '../chat/ArtifactThumbs.vue'
import { toFeed, toTimeline, turnThumbs } from '../chat/chat'
import ChatComposer from '../chat/ChatComposer.vue'
import DateLabel from '../chat/DateLabel.vue'
import HiddenRow from '../chat/HiddenRow.vue'
import MyMessage from '../chat/MyMessage.vue'
import QuestionStepper from '../chat/QuestionStepper.vue'
import QueueTray from '../chat/QueueTray.vue'
import RecapLine from '../chat/RecapLine.vue'
import SessionMenuButton from '../chat/SessionMenuButton.vue'
import SessionMessage from '../chat/SessionMessage.vue'
import SessionStarts from '../chat/SessionStarts.vue'
import SystemLine from '../chat/SystemLine.vue'
import MentionList from '../overlay/MentionList.vue'
import { messageTargetOf, useFeedbackTarget } from '../overlay/useFeedbackTarget'
import { useImageViewer } from '../overlay/useImageViewer'
import { useToast } from '../overlay/useToast'
import HarnessGuide from './HarnessGuide.vue'

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
  /** Connected harnesses and the next step, for an empty chat; null until the server's health answered */
  guide?: Guide | null
  /** The run of messages in view (useStream); without it the feed has nothing older */
  history?: HistoryState
}>()
const emit = defineEmits<{
  thumb: [key: string]
  /** A paired thumbnail pressed again; it also opens the image viewer */
  openImage: [image: Thumb]
  /** Open the session menu */
  sessions: []
  /** From a session's avatar menu: scope to it, or back to 「전체 세션」 (null) */
  scope: [id: string | null]
  /** From a session's avatar menu: mute or unmute it */
  mute: [id: string]
  /** From a session's avatar menu: 「이 세션 데이터 삭제」, which App confirms first */
  delete: [id: string]
  /** The reader reached the start of the run */
  older: []
}>()

// Answering questions is not built yet: question cards are drawn inert.

const feed = ref<HTMLElement>()
const nameOf = (id: string) => props.sessions?.find(s => s.id === id)?.name ?? props.messages.find(m => m.sessionId === id)?.sessionName ?? id
const shortName = (id: string) => splitSessionName(nameOf(id)).session
// Parent paths for names another session shares: whole names here, dirs alone where only the dir shows
const { hintOf, shortHintOf } = useNameHints()
// Ended sessions fade everywhere they appear, and take no feedback
const ended = computed(() => endedSessions(props.sessions ?? []))

// Mute is a client filter with no history, so its lines exist only for changes made
// while this page is open, and only in 「전체 세션」 (OD chat guide 05)
const { muted, forgotten } = useMutedSessions()
const muteEvents = ref<SystemEvent[]>([])
watch(muted, (next, prev) => {
  const at = Date.now()
  const { muted: added, unmuted } = muteChanges(next, prev, forgotten)
  for (const id of added)
    muteEvents.value.push({ key: `mute-${id}-${at}`, at, icon: 'mute', text: '음소거함', sessionId: id })
  for (const id of unmuted)
    muteEvents.value.push({ key: `unmute-${id}-${at}`, at, icon: 'sound', text: `${nameOf(id)} 음소거 해제` })
  // A deleted session's mute line would open a menu for a session that is gone
  muteEvents.value = muteEvents.value.filter(e => !e.sessionId || !forgotten.has(e.sessionId))
})
// Avatar menu: 「이 세션만 보기」, or 「전체 세션 보기」 when already scoped to it
const toggleScope = (id: string) => emit('scope', props.scope === id ? null : id)
// Feedback follows the same view rules as messages: never a muted session, only the scope
const inView = (sessionId: string) => !muted.value.has(sessionId) && (props.scope == null || sessionId === props.scope)
// POST responses, merged so a bubble never waits on the WebSocket frame
const confirmed = shallowRef<Feedback[]>([])
// Items the server removed (discarded, or their session deleted) must not come back from a POST response
watch(() => props.feedback, (next, prev) => confirmed.value = withoutRemoved(confirmed.value, prev, next))
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
// References fold into 「참고 이미지 n」 rows: inside a message that shows anything else, or in
// place of a message that holds nothing but references
const thumbsOf = computed(() => new Map(props.messages.map(m => [m.id, turnThumbs(m)])))
function refsOnly(item: (typeof view.value.items)[number]) {
  const t = thumbsOf.value.get(item.message.id)
  return !item.folded && !item.parts.length && !item.message.questions?.length && !t?.artifacts.length && !!t?.references.length
}
const shown = computed(() => view.value.items.filter(i => !i.folded && !refsOnly(i)).map(i => i.message))
const viewOf = computed(() => new Map(view.value.items.map(i => [i.message.id, i])))
// Folded messages keep their place in the timeline so their rows land where the lines were
// Lines and bubbles before the loaded run wait for the messages around them
const since = computed(() => props.history?.older && props.messages.length ? props.messages[0]!.at : undefined)
const timeline = computed(() => toFeed(
  toTimeline(view.value.items.map(i => i.message), props.sessions, props.scoped ? [] : muteEvents.value, Date.now(), mine.value, since.value),
  (m) => {
    const v = viewOf.value.get(m.id)
    return v?.folded ? v.parts.flatMap(p => p.type === 'hidden' ? p.lines : []) : null
  },
  (m) => {
    const v = viewOf.value.get(m.id)
    return v && refsOnly(v) ? thumbsOf.value.get(m.id)!.references : null
  },
))
const refTimes = (thumbs: Thumb[]) => thumbs.map(t => t.at ?? 0)

// How queued feedback will reach the waiting sessions: one note when they share their routes
// (「바로 전달돼요」 only when every one has a live wake-up hook), else one per group
const queueTrayNote = computed(() => queueNote(
  [...new Set(feedback.value.filter(f => f.deliveredAt == null).map(f => f.sessionId))],
  props.sessions ?? [],
))
// Queued on the server, not yet picked up: the tray, one group per session id
const queue = computed<QueueGroup[]>(() => toQueueGroups(feedback.value, props.sessions ?? [], queueTrayNote.value.mixed, shortName, shortHintOf))
// An ended session's item can be dropped; the server's broadcast takes it off every view
const { toast } = useToast()
async function discard(sessionId: string, id: number) {
  try {
    const gone = new Set(await discardFeedback(sessionId, [id]))
    confirmed.value = confirmed.value.filter(f => !gone.has(f.id))
  }
  catch (error) {
    toast((error as Error).message)
  }
}

// Chat thumbnails open the one app viewer at every width
const { open } = useImageViewer()
function openImage(image: Thumb) {
  open(image.key)
  emit('openImage', image)
}

// The viewer's 「이 이미지에 피드백 ↗」, a cell's or a message's 답장 set the target; the composer
// shows it as its chip: the image with its caption, or the quoted recap line
const { target, setTarget, clearTarget } = useFeedbackTarget()
const attachment = computed<ComposerAttachment | null>(() => target.value && {
  ...(target.value.imageUrl ? { url: target.value.imageUrl } : {}),
  session: nameOf(target.value.sessionId),
  caption: target.value.quote?.text ?? target.value.caption ?? clock(target.value.at),
})
// Messages with a line to quote, by id
const replyTargets = computed(() => new Map(view.value.items.flatMap((v) => {
  const t = messageTargetOf(v)
  return t ? [[v.message.id, t] as const] : []
})))
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

// @세션: the list opens from the button or a typed `@`, and never offers a muted or ended session
const mentioned = ref<string | null>(null)
const mentionQuery = ref<string | null>(null)
const mentionButton = ref(false)
const mentionList = ref<InstanceType<typeof MentionList>>()
const mentionOptions = computed<MentionOption[]>(() => {
  const q = mentionQuery.value?.toLowerCase() ?? ''
  // The typed text matches the name with its hint, so `@repo2` picks one of two `e2e-app`s
  return toSessionRows(props.sessions ?? [], props.messages, muted.value)
    .filter(r => !r.muted && !r.ended)
    .map(r => ({ id: r.id, session: r.session, branch: r.branch, hint: hintOf(r.id) }))
    .filter(o => `${o.hint ?? ''}${o.session}`.toLowerCase().includes(q))
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
// The composer says how a message to the chosen session will reach it
const receiverRoute = computed(() => receiver.value == null ? undefined : sessionRouteNote(receiver.value, props.sessions ?? []))
const blocked = computed(() => props.offline
  ? { icon: 'plug' as const, text: '다시 연결되면 보낼 수 있어요' }
  : receiver.value == null
    ? { icon: 'alert' as const, text: '@로 보낼 세션을 골라 주세요' }
    : ended.value.has(receiver.value) ? { icon: 'alert' as const, text: ENDED_NOTE } : undefined)

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
  const picked = target.value
  const image = picked?.imageUrl
  const quote = picked?.quote && { text: picked.quote.text, at: picked.at }
  // Captured now, so a retry goes where the first try went
  const p: PendingSend = {
    key: `p-${++sendSeq}`,
    request: { sessionId, text, ...(image ? { image } : {}), ...(quote ? { quote } : {}) },
    quote: image
      ? { text: `${shortName(picked.sessionId)} · ${picked.caption ?? clock(picked.at)}`, image }
      : quote && { text: quote.text },
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

// Stick to the bottom only when the reader is already there. Otherwise count what
// arrives and raise 「새 메시지 n ↓」 instead of moving the reader.
const unseen = ref(0)
const isAtEnd = (el: HTMLElement) => el.scrollHeight - el.clientHeight - el.scrollTop < 70
let first = true
// Server ids only grow and upserts keep theirs, so only ids past the highest seen are new.
// Scope changes and unmuting show older messages; those are not counted. Watching what is
// shown means a held line counts when it appears, and a folded message never does.
let lastId = -Infinity
// History (#77): a page joins the run above the reader, who stays where they were
let pagesSeen = props.history?.pages ?? 0
watch(shown, async (list) => {
  const arrived = list.filter(m => m.id > lastId).length
  lastId = Math.max(lastId, ...list.map(m => m.id))
  const el = feed.value
  const atEnd = !el || isAtEnd(el)
  const paged = (props.history?.pages ?? 0) !== pagesSeen
  pagesSeen = props.history?.pages ?? 0
  const keep = el && { top: el.scrollTop, height: el.scrollHeight }
  await nextTick()
  if (paged) {
    // A page that brought nothing new leaves the height as it was, so this holds either way
    if (feed.value && keep)
      feed.value.scrollTop = keep.top + feed.value.scrollHeight - keep.height
  }
  else if (first || atEnd) {
    feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: first ? 'instant' : 'smooth' })
  }
  else {
    unseen.value += arrived
  }
  if (props.messages.length)
    first = false
  maybeLoad()
}, { immediate: true })
// A bubble turning delivered moves to the session's receive time; follow it when at the end
watch(() => mine.value.length, async () => {
  if (!feed.value || !isAtEnd(feed.value))
    return
  await nextTick()
  feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' })
})

/** How close to the top of the feed a page starts loading, in px */
const PAGE_EDGE = 300
/** More than two heights above the latest: 「최신으로 ↓」 shows even with nothing new */
const far = ref(false)
function maybeLoad() {
  const el = feed.value
  const h = props.history
  if (!el || !h || h.loading)
    return
  // A feed too short to scroll keeps loading, so a sparse scope still reaches its messages
  if (h.older && el.scrollTop < PAGE_EDGE)
    emit('older')
}
watch(() => props.history?.loading, loading => loading === false && nextTick(maybeLoad))

function measureFar() {
  const el = feed.value
  if (el)
    far.value = el.scrollHeight - el.clientHeight - el.scrollTop > 2 * el.clientHeight
}
function onScroll() {
  const el = feed.value
  if (!el)
    return
  if (isAtEnd(el))
    unseen.value = 0
  measureFar()
  maybeLoad()
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
    <!-- Sessions known, nothing said yet: who is connected and what comes next -->
    <StateView v-else-if="!timeline.length" :title="scoped ? '이 세션에는 아직 대화가 없어요.' : '아직 대화가 없어요.'">
      <HarnessGuide v-if="guide" :guide="guide" place="chat" />
    </StateView>
    <div v-else class="feed-box">
      <div ref="feed" class="feed" role="log" aria-label="세션 메시지" tabindex="-1" @scroll.passive="onScroll">
        <template v-for="item in timeline" :key="item.key">
          <DateLabel v-if="item.type === 'date'" :label="item.label" />
          <SystemLine v-else-if="item.type === 'system'" :icon="item.icon" :text="item.text">
            <!-- A muted session's messages are gone, so its menu opens from the mute line -->
            <template v-if="item.sessionId" #lead>
              <SessionMenuButton
                small :name="nameOf(item.sessionId)" :hint="hintOf(item.sessionId)" :muted="muted.has(item.sessionId)" :ended="ended.has(item.sessionId)"
                :scoped="scope === item.sessionId" @scope="toggleScope(item.sessionId)" @mute="emit('mute', item.sessionId)"
                @delete="emit('delete', item.sessionId)"
              />
            </template>
          </SystemLine>
          <SessionStarts v-else-if="item.type === 'starts'" :rows="item.rows" :lead="item.lead" />
          <HiddenRow
            v-else-if="item.type === 'hidden'" :lines="item.lines"
            :model-value="openRows.has(item.key)" @update:model-value="toggleRow(item.key, $event)"
          />
          <HiddenRow
            v-else-if="item.type === 'refs'" label="참고 이미지" icon="image" :times="refTimes(item.thumbs)"
            :model-value="openRows.has(item.key)" @update:model-value="toggleRow(item.key, $event)"
          >
            <ArtifactThumbs reference :thumbs="item.thumbs" @open-image="openImage" />
          </HiddenRow>
          <MyMessage
            v-else-if="item.type === 'mine'" :target="shortName(item.entry.sessionId)" :target-hint="shortHintOf(item.entry.sessionId)" :text="item.entry.text"
            :quote="item.entry.quote" :state="item.entry.state" :at="item.entry.deliveredAt"
            :via="item.entry.via && VIA_LABEL[item.entry.via]" :reason="item.entry.pending?.reason"
            @retry="item.entry.pending && retry(item.entry.pending)"
          />
          <SessionMessage
            v-else :name="item.message.sessionName" :hint="hintOf(item.message.sessionId)" :at="item.message.at"
            :highlighted="selectedMessage === item.message.id" :data-msg="item.message.id"
            :scoped="scope === item.message.sessionId" :ended="ended.has(item.message.sessionId)"
            :replyable="replyTargets.has(item.message.id)"
            @scope="toggleScope(item.message.sessionId)" @mute="emit('mute', item.message.sessionId)"
            @delete="emit('delete', item.message.sessionId)" @reply="setTarget({ ...replyTargets.get(item.message.id)! })"
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
              v-if="thumbsOf.get(item.message.id)?.artifacts.length" :thumbs="thumbsOf.get(item.message.id)!.artifacts"
              :tool-name="item.message.toolName" :active="selected" @pick="$emit('thumb', $event)" @open-image="openImage"
            />
            <HiddenRow
              v-if="thumbsOf.get(item.message.id)?.references.length" inset label="참고 이미지" icon="image"
              :times="refTimes(thumbsOf.get(item.message.id)!.references)"
              :model-value="openRows.has(`r-${item.message.id}`)" @update:model-value="toggleRow(`r-${item.message.id}`, $event)"
            >
              <ArtifactThumbs reference :thumbs="thumbsOf.get(item.message.id)!.references" @open-image="openImage" />
            </HiddenRow>
            <!-- Answering is not built yet; several questions step in one card -->
            <QuestionStepper
              v-if="item.message.questions?.length" :questions="item.message.questions" inert
              :state="offline ? 'offline' : 'open'"
            />
          </SessionMessage>
        </template>
      </div>
      <!-- Nothing arrives while offline, so no pill then (OD banner guide 08) -->
      <!-- Arrivals, or far back in a long run: either way back is the pill -->
      <NewPill v-if="(unseen || far) && !offline" kind="message" :count="unseen" @click="jumpToLatest" />
    </div>
    <ChatComposer
      ref="composer" can-send hint="@세션을 부르거나, 산출물에 답장해 보세요" :route="receiverRoute" :blocked="blocked"
      :target="receiver && shortName(receiver)" :target-hint="receiver ? shortHintOf(receiver) : undefined" :attachment="attachment" :mention-open="mentionOpen"
      @update:attachment="onAttachment" @send="send"
      @mention="mentionButton = !mentionButton" @mention-query="mentionQuery = $event"
      @mention-focus="mentionList?.focusFirst()" @mention-close="closeMention"
    >
      <template v-if="queue.length" #tray>
        <QueueTray :groups="queue" :note="queueTrayNote.note" :actions="false" @discard="discard" />
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
  /* A page joining above keeps the reader's place by hand (the scrollHeight delta), which the browser's own anchoring would double */
  overflow-anchor: none;
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
