<script setup lang="ts">
import { clock } from '../../artifacts'
import FloatingActions from '../overlay/FloatingActions.vue'
import SessionAvatar from './SessionAvatar.vue'
import SessionName from './SessionName.vue'

// Avatar · session · branch · time, then the body. Text without a surface; recap lines with a
// state and the question card are the only boxes inside it.
defineProps<{
  /** `<dir>` or `<dir> · <branch>` */
  name: string
  at: number
  /** Paired with the artifact picked in the stream */
  highlighted?: boolean
}>()
</script>

<template>
  <article class="message" :class="{ highlighted }" data-floating-host>
    <!-- 답장 on hover or focus; drawn disabled until intervention exists -->
    <FloatingActions variant="message" />
    <div class="message-head">
      <SessionAvatar :name="name" />
      <strong><SessionName :name="name" /></strong>
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
.message-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
}
.message-head strong {
  display: flex;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
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
  .message-head strong {
    font-size: 10px;
  }
  .message-body {
    --indent: 29px;
  }
}
</style>
