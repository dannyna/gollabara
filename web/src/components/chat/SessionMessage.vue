<script setup lang="ts">
import { computed } from 'vue'
import { clock, splitSessionName } from '../../artifacts'
import FloatingActions from '../overlay/FloatingActions.vue'
import SessionAvatar from './SessionAvatar.vue'

// Avatar · session · branch · time, then the body. Text without a surface; the
// question card is the only surface that sits inside it.
const props = defineProps<{
  /** `<dir>` or `<dir> · <branch>` */
  name: string
  at: number
  /** Paired with the artifact picked in the stream */
  highlighted?: boolean
}>()
const parts = computed(() => splitSessionName(props.name))
</script>

<template>
  <article class="message" :class="{ highlighted }" data-floating-host>
    <!-- 답장 on hover or focus; drawn disabled until intervention exists -->
    <FloatingActions variant="message" />
    <div class="message-head">
      <SessionAvatar :name="name" />
      <strong>{{ parts.session }}<span v-if="parts.branch" class="branch"> · {{ parts.branch }}</span></strong>
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
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.branch {
  color: var(--muted);
  font-weight: 400;
}
.message-head time {
  margin-left: auto;
  flex: none;
  font-size: 9px;
  color: var(--muted);
}
.message-body {
  padding-left: 31px;
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
    padding-left: 29px;
  }
}
</style>
