<script setup lang="ts">
import type { SwipeAxis } from './chat'
import { computed, ref } from 'vue'
import { clock } from '../../artifacts'
import FloatingActions from '../overlay/FloatingActions.vue'
import { SWIPE_REPLY_PX, swipeAxis, swipeOffset } from './chat'
import ChatIcon from './ChatIcon.vue'
import SessionMenuButton from './SessionMenuButton.vue'

// Avatar · session · branch · time, then the body. Text without a surface; recap lines with a
// state and the question card are the only boxes inside it. The avatar and the name open the
// session's avatar menu.
const props = defineProps<{
  /** `<dir>` or `<dir> · <branch>` */
  name: string
  /** Parent path when another session has the same name (names.ts) */
  hint?: string
  at: number
  /** Paired with the artifact picked in the stream */
  highlighted?: boolean
  /** The view is scoped to this session: the menu offers 「전체 세션 보기」 */
  scoped?: boolean
  /** The session ended: the head and the text fade to muted; images keep their own colours */
  ended?: boolean
  /** The message has a recap line to quote: 답장 shows on hover or focus, or a swipe right on touch; off once the session ended */
  replyable?: boolean
}>()

const emit = defineEmits<{ scope: [], mute: [], delete: [], reply: [] }>()

// Touch: dragging the message right past SWIPE_REPLY_PX quotes it, as 답장 does. A drag that
// heads anywhere else is left to the scroll. It may start on the head, like anywhere a finger
// lands on a message, but not on the body's controls or the thumbnail strip, which scrolls sideways.
const swipeable = computed(() => props.replyable && !props.ended)
const offset = ref(0)
const armed = computed(() => offset.value >= SWIPE_REPLY_PX)
let drag: { id: number, x: number, y: number, axis: SwipeAxis } | null = null
// A swipe that started on the head must not also open the session menu
let swallowClickUntil = 0
const NO_SWIPE = '.message-body button, a, input, textarea, select, .thumbs'

function onDown(e: PointerEvent) {
  if (e.pointerType !== 'touch' || !swipeable.value || drag || (e.target as Element).closest(NO_SWIPE))
    return
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: 'pending' }
}
function onMove(e: PointerEvent) {
  if (drag?.id !== e.pointerId)
    return
  const dx = e.clientX - drag.x
  if (drag.axis === 'pending') {
    drag.axis = swipeAxis(dx, e.clientY - drag.y)
    if (drag.axis === 'y')
      drag = null
    if (drag?.axis !== 'x')
      return
    // Keep the moves coming once the finger leaves the message
    const host = e.currentTarget as Element
    host.setPointerCapture(e.pointerId)
  }
  const next = swipeOffset(dx)
  if (next >= SWIPE_REPLY_PX && !armed.value)
    navigator.vibrate?.(8)
  offset.value = next
}
function onEnd(e: PointerEvent) {
  if (drag?.id !== e.pointerId)
    return
  const reply = e.type === 'pointerup' && armed.value
  if (drag.axis === 'x')
    swallowClickUntil = e.timeStamp + 500
  drag = null
  offset.value = 0
  if (reply)
    emit('reply')
}
function onClick(e: MouseEvent) {
  if (e.timeStamp < swallowClickUntil) {
    e.preventDefault()
    e.stopPropagation()
  }
  swallowClickUntil = 0
}
</script>

<template>
  <article
    class="message" :class="{ highlighted, ended, swipeable }" data-floating-host
    @pointerdown="onDown" @pointermove="onMove" @pointerup="onEnd" @pointercancel="onEnd" @click.capture="onClick"
  >
    <!-- 답장 on hover or focus quotes the message in the composer -->
    <FloatingActions v-if="replyable" variant="message" :reply="!ended" :reply-label="`${name} 메시지에 답장`" @reply="$emit('reply')" />
    <!-- Revealed behind the message as it slides; the swipe is a shortcut for the bar's 답장 -->
    <span v-if="offset" class="swipe-cue" :class="{ armed }" :style="{ '--progress': Math.min(1, offset / SWIPE_REPLY_PX) }" aria-hidden="true">
      <ChatIcon name="reply" />
    </span>
    <div class="slide" :class="{ dragging: offset > 0 }" :style="offset ? { transform: `translateX(${offset}px)` } : undefined">
      <div class="message-head">
        <SessionMenuButton :name="name" :hint="hint" :scoped="scoped" :ended="ended" @scope="$emit('scope')" @mute="$emit('mute')" @delete="$emit('delete')" />
        <time>{{ clock(at) }}</time>
      </div>
      <div class="message-body">
        <slot />
      </div>
    </div>
  </article>
</template>

<style scoped>
.message {
  position: relative;
  margin: 0 0 20px;
  border-radius: 9px;
  transition: background 0.16s;
}
.message.highlighted {
  background: var(--bg);
  outline: 1px solid var(--border);
  outline-offset: 8px;
}
.message.swipeable {
  /* Sideways drags are the swipe's; vertical ones still scroll the chat */
  touch-action: pan-y pinch-zoom;
}
.slide {
  transition: transform 0.2s;
}
.slide.dragging {
  transition: none;
}
.swipe-cue {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--muted);
  opacity: var(--progress);
  transform: scale(calc(0.6 + 0.4 * var(--progress)));
}
.swipe-cue.armed {
  background: var(--fg);
  color: var(--bg);
}
.swipe-cue .chat-icon {
  width: 16px;
  height: 16px;
}
.message.ended .message-body {
  color: var(--muted);
}
.message-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
}
.message-head time {
  margin-left: auto;
  flex: none;
  font-size: 9px;
  color: var(--muted);
}
.message-body {
  /* Recap line boxes reach back over this indent into the avatar column */
  --indent: 31px;
  padding-left: var(--indent);
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .message {
    margin-bottom: 16px;
  }
  .message-body {
    max-width: 590px;
  }
}
@media (max-width: 767px) {
  .message {
    margin-bottom: 21px;
  }
  .message-body {
    --indent: 29px;
  }
}
</style>
