<script setup lang="ts">
import type { StreamMessage } from '../../../../src/shared/types'
import { nextTick, ref, watch } from 'vue'
import { artifactKey, clock, splitSessionName } from '../../artifacts'

const props = defineProps<{
  messages: StreamMessage[]
  offline?: boolean
  /** Key of the selected artifact, to mark its thumbnail */
  selected?: string | null
  /** Message the selected artifact belongs to, to highlight it */
  selectedMessage?: number | null
}>()
defineEmits<{ thumb: [key: string] }>()

// PLACEHOLDER until the chat components land (#16): a plain list, one entry per
// turn (thumbnails, then each recap on its own line), and questions as plain text.
// The composer is drawn disabled: sending to sessions is a later track (DESIGN.md).

const feed = ref<HTMLElement>()
const recaps = (m: StreamMessage) => m.recaps ?? (m.text ? [m.text] : [])
const initial = (name: string) => splitSessionName(name).session.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toLowerCase()

// Stick to the bottom only when the reader is already there
let first = true
watch(() => props.messages, async () => {
  const el = feed.value
  const atEnd = !el || el.scrollHeight - el.clientHeight - el.scrollTop < 70
  await nextTick()
  if (first || atEnd)
    feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: first ? 'instant' : 'smooth' })
  if (props.messages.length)
    first = false
}, { immediate: true })

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
    <div v-if="offline" class="disconnected-note">
      연결을 기다리는 중이에요. 이전 대화는 계속 볼 수 있어요.
    </div>
    <div ref="feed" class="feed" role="log" aria-label="세션 메시지">
      <article
        v-for="m in messages" :key="m.id" class="message"
        :class="{ highlighted: selectedMessage === m.id }" :data-msg="m.id"
      >
        <div class="head">
          <span class="avatar" aria-hidden="true">{{ initial(m.sessionName) }}</span>
          <strong>{{ splitSessionName(m.sessionName).session }}<span v-if="splitSessionName(m.sessionName).branch" class="branch"> · {{ splitSessionName(m.sessionName).branch }}</span></strong>
          <time>{{ clock(m.at) }}</time>
        </div>
        <div class="body">
          <div v-if="m.images?.length" class="thumbs">
            <button
              v-for="(img, i) in m.images" :key="i" class="thumb" type="button"
              :class="{ active: selected === artifactKey(m.id, i) }" :aria-label="`이미지 ${i + 1} 선택`"
              @click="$emit('thumb', artifactKey(m.id, i))"
            >
              <img :src="img.url" alt="" :style="{ aspectRatio: `${img.width} / ${img.height}` }">
            </button>
          </div>
          <p v-for="(line, i) in recaps(m)" :key="i">
            {{ line }}
          </p>
          <p v-for="(q, qi) in m.questions" :key="`q${qi}`">
            {{ q.question }}
          </p>
        </div>
      </article>
    </div>
    <div class="composer">
      <div class="box">
        <textarea
          rows="1" disabled aria-label="세션에 메시지 보내기"
          :placeholder="offline ? '연결되면 다시 말할 수 있어요' : '세션에 메시지나 피드백을 남겨보세요'"
        />
        <div class="box-bottom">
          <button class="mention" type="button" disabled>
            @ 세션
          </button>
          <button class="send" type="button" disabled aria-label="메시지 보내기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
          </button>
        </div>
      </div>
      <div class="note">
        <span class="desktop-hint">@세션을 부르거나, 산출물에 답장해 보세요</span>
        <span class="mobile-hint">메시지를 오른쪽으로 밀면 답장</span>
        <span>보내기는 준비 중이에요</span>
      </div>
    </div>
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
.disconnected-note {
  padding: 8px 24px;
  font-size: 11px;
  color: var(--muted);
  background: var(--bg);
  border-bottom: 1px solid var(--border);
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
.message {
  margin: 0 0 20px;
  border-radius: 9px;
  transition: background 0.16s;
}
.message.highlighted {
  background: var(--bg);
  outline: 1px solid var(--border);
  outline-offset: 8px;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
}
.avatar {
  width: 23px;
  height: 23px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--bg);
  font: 600 11px var(--display);
}
.head strong {
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.branch {
  color: var(--muted);
  font-weight: 400;
}
.head time {
  margin-left: auto;
  flex: none;
  font-size: 9px;
  color: var(--muted);
}
.body {
  padding-left: 31px;
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.thumbs {
  display: flex;
  gap: 7px;
  overflow: auto;
  margin: 8px 0 5px;
  padding-bottom: 3px;
  scrollbar-width: thin;
}
.thumb {
  height: 77px;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg);
}
.thumb:hover:not(:disabled) {
  background: var(--bg);
  border-color: var(--muted);
}
.thumb.active {
  outline: 2px solid var(--fg);
  outline-offset: -2px;
}
.thumb img {
  display: block;
  height: 100%;
  width: auto;
}

.composer {
  flex: none;
  padding: 13px 20px 17px;
  background: var(--surface);
}
.box {
  padding: 9px 10px 8px;
  border-radius: 16px;
  background: var(--bg);
  box-shadow: inset 0 1px 4px oklch(0 0 0 / 0.13);
}
.box textarea {
  display: block;
  width: 100%;
  min-height: 37px;
  padding: 0 3px;
  resize: none;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--fg);
  font-size: 12px;
  line-height: 1.7;
}
.box textarea::placeholder {
  color: var(--muted);
}
.box-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mention {
  min-height: 32px;
  padding: 0 4px;
  color: var(--muted);
  font-size: 11px;
}
.send {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--fg);
  color: var(--surface);
}
.send svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.note {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin: 7px 3px 0;
  font-size: 9px;
  color: var(--muted);
}
.mobile-hint {
  display: none;
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
  .message {
    margin-bottom: 16px;
  }
  .composer {
    padding: 9px 22px 13px;
  }
  .box {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  .box textarea {
    height: 29px;
    min-height: 29px;
  }
  .box-bottom {
    gap: 12px;
  }
  .note {
    margin-top: 4px;
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
  .message {
    margin-bottom: 21px;
  }
  .body {
    padding-left: 29px;
  }
  .thumb {
    height: 120px;
  }
  .composer {
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  }
  .box textarea {
    height: 33px;
    min-height: 33px;
    font-size: 16px;
  }
  .box textarea::placeholder {
    font-size: 12px;
  }
  .desktop-hint {
    display: none;
  }
  .mobile-hint {
    display: inline;
  }
}
@media (max-width: 767px), (pointer: coarse) {
  .mention,
  .send {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
