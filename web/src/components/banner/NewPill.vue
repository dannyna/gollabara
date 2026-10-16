<script setup lang="ts">
// Floating way back to the latest item while the reader browses history. The parent is
// the positioning box: the stream panel (64 above its bottom, 36 on tablet) or the chat
// feed (14 above the composer). Surface, not yellow: it is a way back, not a main action.
//
// The count is what actually arrived, never shortened to 「99+」. A plain button: count
// changes are not announced, since the screen stays open all day. After the click the
// parent scrolls to the latest and moves focus to the track or the feed.
//
// With no count it reads 「최신으로」: the way back from far back in a long history, when
// nothing new has arrived (#77).
defineProps<{
  count: number
  /** `artifact` sits on the stream (→), `message` on the chat (↓) */
  kind: 'artifact' | 'message'
}>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button class="new-pill" :class="kind" type="button" @click="$emit('click')">
    {{ !count ? `최신으로 ${kind === 'artifact' ? '→' : '↓'}` : kind === 'artifact' ? `새 산출물 ${count} →` : `새 메시지 ${count} ↓` }}
  </button>
</template>

<style scoped>
.new-pill {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid var(--border);
  border-radius: 40px;
  background: var(--surface);
  box-shadow: 0 5px 24px var(--shade);
  font-size: 12px;
  white-space: nowrap;
}
.artifact {
  bottom: 64px;
}
.message {
  bottom: 14px;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .artifact {
    bottom: 36px;
  }
}
</style>
