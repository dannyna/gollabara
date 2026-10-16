<script setup lang="ts">
import { clock } from '../../artifacts'
import FloatingActions from '../overlay/FloatingActions.vue'
import SessionMenuButton from './SessionMenuButton.vue'

// Avatar · session · branch · time, then the body. Text without a surface; recap lines with a
// state and the question card are the only boxes inside it. The avatar and the name open the
// session's avatar menu.
defineProps<{
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
  /** The message has a recap line to quote: 답장 shows on hover or focus, disabled once the session ended */
  replyable?: boolean
}>()

defineEmits<{ scope: [], mute: [], delete: [], reply: [] }>()
</script>

<template>
  <article class="message" :class="{ highlighted, ended }" data-floating-host>
    <!-- 답장 on hover or focus quotes the message in the composer -->
    <FloatingActions v-if="replyable" variant="message" :reply="!ended" :reply-label="`${name} 메시지에 답장`" @reply="$emit('reply')" />
    <div class="message-head">
      <SessionMenuButton :name="name" :hint="hint" :scoped="scoped" :ended="ended" @scope="$emit('scope')" @mute="$emit('mute')" @delete="$emit('delete')" />
      <time>{{ clock(at) }}</time>
    </div>
    <div class="message-body">
      <slot />
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
