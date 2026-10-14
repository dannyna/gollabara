<script setup lang="ts">
import type { Session, StreamMessage } from '../../../../src/shared/types'
import type { Thumb } from '../chat/ArtifactThumbs.vue'
import type { SystemEvent } from '../chat/chat'
import type { ComposerAttachment, ComposerSend } from '../chat/ChatComposer.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { artifactKey, clock } from '../../artifacts'
import { useMutedSessions } from '../../sessions'
import NewPill from '../banner/NewPill.vue'
import NoticeLine from '../banner/NoticeLine.vue'
import StateView from '../banner/StateView.vue'
import ArtifactThumbs from '../chat/ArtifactThumbs.vue'
import { toTimeline } from '../chat/chat'
import ChatComposer from '../chat/ChatComposer.vue'
import DateLabel from '../chat/DateLabel.vue'
import QuestionCard from '../chat/QuestionCard.vue'
import SessionMessage from '../chat/SessionMessage.vue'
import SystemLine from '../chat/SystemLine.vue'
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
  /** Delivery to sessions is wired elsewhere; until then the composer stays disabled */
  canSend?: boolean
  /** Viewing one session rather than 「전체 세션」 */
  scoped?: boolean
  /** The scope is a muted session (unreachable today: muting the scope resets it) */
  scopeMuted?: boolean
  /** Every session is muted, so nothing is in view */
  allMuted?: boolean
}>()
const emit = defineEmits<{
  thumb: [key: string]
  /** A paired thumbnail pressed again; it also opens the image viewer */
  openImage: [image: Thumb]
  send: [payload: ComposerSend]
  /** Open the session menu */
  sessions: []
}>()

// Answering questions is not built yet: question cards are drawn inert.

const feed = ref<HTMLElement>()
const nameOf = (id: string) => props.sessions?.find(s => s.id === id)?.name ?? props.messages.find(m => m.sessionId === id)?.sessionName ?? id

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
const timeline = computed(() => toTimeline(props.messages, props.sessions, props.scoped ? [] : muteEvents.value))

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
const recaps = (m: StreamMessage) => m.recaps ?? (m.text ? [m.text] : [])
const thumbs = (m: StreamMessage) => (m.images ?? []).map((img, i) => ({ key: artifactKey(m.id, i), ...img }))

// Stick to the bottom only when the reader is already there. Otherwise count what
// arrives and raise 「새 메시지 n ↓」 instead of moving the reader.
const unseen = ref(0)
const isAtEnd = (el: HTMLElement) => el.scrollHeight - el.clientHeight - el.scrollTop < 70
let first = true
// Server ids only grow and upserts keep theirs, so only ids past the highest seen are new.
// Scope changes and unmuting reveal older messages; those are not counted.
let lastId = -Infinity
watch(() => props.messages, async (list) => {
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
      <span>질문에 답하고, 피드백을 남겨요</span>
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
          <SessionMessage
            v-else :name="item.message.sessionName" :at="item.message.at"
            :highlighted="selectedMessage === item.message.id" :data-msg="item.message.id"
          >
            <p v-for="(line, i) in recaps(item.message)" :key="i">
              {{ line }}
            </p>
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
      :can-send="canSend" hint="@세션을 부르거나, 산출물에 답장해 보세요"
      :blocked="offline ? { icon: 'plug', text: '다시 연결되면 보낼 수 있어요' } : undefined"
      :note="canSend ? undefined : '보내기는 준비 중이에요'" :attachment="attachment"
      @update:attachment="onAttachment" @send="$emit('send', $event)"
    />
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
    height: 42px;
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
    height: 40px;
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
