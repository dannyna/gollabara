<script setup lang="ts">
import type { Session, StreamMessage } from '../../../../src/shared/types'
import type { Thumb } from '../chat/ArtifactThumbs.vue'
import type { ComposerSend } from '../chat/ChatComposer.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { artifactKey } from '../../artifacts'
import NewPill from '../banner/NewPill.vue'
import NoticeLine from '../banner/NoticeLine.vue'
import ArtifactThumbs from '../chat/ArtifactThumbs.vue'
import { toTimeline } from '../chat/chat'
import ChatComposer from '../chat/ChatComposer.vue'
import DateLabel from '../chat/DateLabel.vue'
import QuestionCard from '../chat/QuestionCard.vue'
import SessionMessage from '../chat/SessionMessage.vue'
import SystemLine from '../chat/SystemLine.vue'

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
}>()
defineEmits<{
  thumb: [key: string]
  /** A paired thumbnail pressed again; the image viewer (#17) opens it */
  openImage: [image: Thumb]
  send: [payload: ComposerSend]
}>()

// Answering questions is not built yet: question cards are drawn inert.

const feed = ref<HTMLElement>()
const timeline = computed(() => toTimeline(props.messages, props.sessions))
const recaps = (m: StreamMessage) => m.recaps ?? (m.text ? [m.text] : [])
const thumbs = (m: StreamMessage) => (m.images ?? []).map((img, i) => ({ key: artifactKey(m.id, i), ...img }))

// Stick to the bottom only when the reader is already there. Otherwise count what
// arrives and raise 「새 메시지 n ↓」 instead of moving the reader.
const unseen = ref(0)
const isAtEnd = (el: HTMLElement) => el.scrollHeight - el.clientHeight - el.scrollTop < 70
let first = true
watch(() => props.messages, async (list, prev) => {
  const el = feed.value
  const atEnd = !el || isAtEnd(el)
  await nextTick()
  if (first || atEnd)
    feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: first ? 'instant' : 'smooth' })
  else if (prev && list.length > prev.length)
    unseen.value += list.length - prev.length
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
    <div class="feed-box">
      <div ref="feed" class="feed" role="log" aria-label="세션 메시지" tabindex="-1" @scroll.passive="onScroll">
        <template v-for="item in timeline" :key="item.key">
          <DateLabel v-if="item.type === 'date'" :label="item.label" />
          <SystemLine v-else-if="item.type === 'start'" icon="start" :text="`${item.name} 시작`" />
          <SessionMessage
            v-else :name="item.message.sessionName" :at="item.message.at"
            :highlighted="selectedMessage === item.message.id" :data-msg="item.message.id"
          >
            <p v-for="(line, i) in recaps(item.message)" :key="i">
              {{ line }}
            </p>
            <ArtifactThumbs
              v-if="item.message.images?.length" :thumbs="thumbs(item.message)" :tool-name="item.message.toolName"
              :active="selected" @pick="$emit('thumb', $event)" @open-image="$emit('openImage', $event)"
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
      :note="canSend ? undefined : '보내기는 준비 중이에요'"
      @send="$emit('send', $event)"
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
