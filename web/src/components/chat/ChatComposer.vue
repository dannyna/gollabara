<script setup lang="ts">
import type { BannerIconName } from '../banner/BannerIcon.vue'
import { computed, ref, useId, watch } from 'vue'
import InlineNote from '../banner/InlineNote.vue'
import ChatIcon from './ChatIcon.vue'
import SessionAvatar from './SessionAvatar.vue'

// Always shows who a message goes to. It only emits `send`; delivery to sessions
// lives elsewhere (ChatPanel). With `canSend` off every control is drawn disabled.
export interface ComposerAttachment {
  /** Image URL for the thumbnail */
  url: string
  /** Session that made the image */
  session: string
  /** e.g. 「히어로 A · 14:34」 */
  caption: string
}
export interface ComposerSend {
  text: string
  attachment?: ComposerAttachment
}

const props = withDefaults(defineProps<{
  /** Off draws every control disabled */
  canSend?: boolean
  /** Receiving session, shown as a chip; none in 「전체 세션」 until one is picked with @ */
  target?: string | null
  /** Initial draft */
  text?: string
  placeholder?: string
  /** Muted line under the box; defaults to the Enter hint unless sending is blocked */
  note?: string
  /** Desktop-only muted hint at the start of the note line */
  hint?: string
  /** Why sending is blocked right now (offline, no target, tray full): replaces the hint in fg */
  blocked?: { text: string, icon: BannerIconName }
  /** Turns off only the send button; the draft stays */
  sendDisabled?: boolean
  /** Quoted artifact above the input, removable with × (v-model:attachment) */
  attachment?: ComposerAttachment | null
  /** The @세션 list in the popover slot is open: ↓ moves into it, Escape closes it */
  mentionOpen?: boolean
}>(), { canSend: false, placeholder: '세션에 메시지나 피드백을 남겨보세요' })

const emit = defineEmits<{
  'send': [payload: ComposerSend]
  'update:attachment': [value: ComposerAttachment | null]
  /** 「@ 세션」 pressed */
  'mention': []
  /** What follows a typed `@` at the end of the draft, or null when there is none */
  'mentionQuery': [query: string | null]
  /** ↓ while the list is open */
  'mentionFocus': []
  'mentionClose': []
}>()

const draft = ref(props.text ?? '')
watch(() => props.text, t => draft.value = t ?? '')
const MENTION = /(?:^|\s)@(\S*)$/
watch(draft, (text, prev) => {
  const query = text.match(MENTION)?.[1] ?? null
  if (query !== (prev.match(MENTION)?.[1] ?? null))
    emit('mentionQuery', query)
})
// The button stays lit on an empty draft, as in the guide; an empty send does nothing
const sendable = computed(() => props.canSend && !props.sendDisabled && !props.blocked)
const noteText = computed(() => props.note ?? (props.blocked ? undefined : 'Enter로 보내기 · Shift+Enter 줄바꿈'))
// The note line describes the input, so a blocked reason is read with it
const noteId = useId()

function send() {
  // The server takes no empty feedback, even with an image attached
  if (!sendable.value || !draft.value.trim())
    return
  emit('send', { text: draft.value.trim(), ...(props.attachment ? { attachment: props.attachment } : {}) })
  draft.value = ''
  emit('update:attachment', null)
}
function onKeydown(e: KeyboardEvent) {
  if (props.mentionOpen && (e.key === 'ArrowDown' || e.key === 'Escape')) {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape')
      emit('mentionClose')
    else
      emit('mentionFocus')
    return
  }
  // Enter sends, Shift+Enter breaks the line; never while an IME is composing Hangul
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}

const input = ref<HTMLTextAreaElement>()
/** After a pick: drop the typed `@query` and return to the input */
function pickedMention() {
  draft.value = draft.value.replace(MENTION, m => m.startsWith('@') ? '' : m[0]!)
  input.value?.focus()
}
/** Replaces the draft (an advisor's draft reply) and focuses it; never sends */
function fill(text: string) {
  draft.value = text
  input.value?.focus()
}
defineExpose({ focus: () => input.value?.focus(), pickedMention, fill })
</script>

<template>
  <!-- The queue tray sits on top of the composer -->
  <slot name="tray" />
  <form class="composer" @submit.prevent="send">
    <!-- Anchored lists (the @세션 picker) open here, above the box -->
    <slot name="popover" />
    <div v-if="attachment" class="reply-context">
      <img :src="attachment.url" alt=""><span>↪ <b>{{ attachment.session }}</b> · {{ attachment.caption }}</span>
      <button class="icon-button" type="button" aria-label="인용 취소" @click="emit('update:attachment', null)">
        <ChatIcon name="close" />
      </button>
    </div>
    <div class="compose-box">
      <div v-if="target" class="target-chip">
        <SessionAvatar :name="target" small />→ {{ target }}
      </div>
      <textarea
        ref="input" v-model="draft" rows="1" aria-label="세션에 메시지 보내기" :aria-describedby="noteId" :placeholder="placeholder"
        :disabled="!canSend"
        @keydown="onKeydown"
      />
      <div class="compose-bottom">
        <button class="mention" type="button" :disabled="!canSend" :aria-expanded="mentionOpen" @click="emit('mention')">
          @ 세션
        </button>
        <button class="send" type="submit" aria-label="메시지 보내기" :disabled="!sendable">
          <ChatIcon name="send" />
        </button>
      </div>
    </div>
    <div :id="noteId" class="composer-note">
      <InlineNote v-if="blocked" tone="blocked" :icon="blocked.icon">
        {{ blocked.text }}
      </InlineNote>
      <InlineNote v-else-if="hint" class="desktop-hint">
        {{ hint }}
      </InlineNote>
      <span v-if="noteText">{{ noteText }}</span>
    </div>
  </form>
</template>

<style scoped>
.composer {
  position: relative;
  flex: none;
  padding: 13px 20px 17px;
  background: var(--surface);
}
.compose-box {
  padding: 9px 10px 8px;
  border-radius: 16px;
  background: var(--bg);
  box-shadow: inset 0 1px 4px oklch(0 0 0 / 0.13);
}
.compose-box:has(textarea:focus-visible) {
  outline: 2px solid var(--fg);
  outline-offset: 3px;
}
.compose-box textarea {
  display: block;
  width: 100%;
  min-height: 37px;
  max-height: 100px;
  padding: 0 3px;
  resize: none;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--fg);
  font-size: 12px;
  line-height: 1.7;
}
.compose-box textarea::placeholder {
  color: var(--muted);
}
.target-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0 0 6px 3px;
  font: 500 11px var(--mono);
}
.target-chip .session-avatar {
  background: var(--surface);
}
.compose-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* Sits beside the input on tablet; never squeeze 「@ 세션」 onto two lines */
  flex: none;
}
.mention {
  min-height: 32px;
  padding: 0 4px;
  white-space: nowrap;
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
.send:hover:not(:disabled) {
  background: var(--fg);
  color: var(--surface);
  transform: translateY(-1px);
}
.send:disabled {
  opacity: 1;
  background: var(--border);
  color: var(--muted);
}
.send .chat-icon {
  width: 16px;
  height: 16px;
}
.composer-note {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin: 7px 3px 0;
  font-size: 9px;
  color: var(--muted);
}
.reply-context {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 3px 8px;
  font-size: 11px;
}
.reply-context span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reply-context b {
  font-weight: 600;
}
.reply-context img {
  width: 19px;
  height: 25px;
  object-fit: cover;
  border-radius: 2px;
}
.icon-button {
  width: 28px;
  height: 28px;
  margin-left: auto;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  flex: none;
  border-radius: 9px;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .composer {
    padding: 9px 22px 13px;
  }
  .compose-box {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 15px;
  }
  .target-chip {
    flex-basis: 100%;
  }
  .compose-box textarea {
    flex: 1;
    width: auto;
    height: 29px;
    min-height: 29px;
  }
  .compose-bottom {
    gap: 12px;
  }
  .composer-note {
    margin-top: 4px;
  }
}
@media (max-width: 767px) {
  .composer {
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  }
  .compose-box {
    padding: 10px 11px 7px;
  }
  .compose-box textarea {
    height: 33px;
    min-height: 33px;
    font-size: 16px;
  }
  .compose-box textarea::placeholder {
    font-size: 12px;
  }
  .send {
    width: 36px;
    height: 36px;
  }
  .desktop-hint {
    display: none;
  }
}
@media (max-width: 767px), (pointer: coarse) {
  .mention,
  .send,
  .icon-button {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
