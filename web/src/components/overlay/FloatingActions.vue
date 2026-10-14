<script setup lang="ts">
// Floating action bar on an artifact cell or a session message. It shows while the
// pointer or keyboard focus is inside the host, which carries `data-floating-host`.
// At most three actions: cell 답장 · 멈춤 · 확대 ↗, message 답장 · 멈춤.

withDefaults(defineProps<{
  variant?: 'cell' | 'message'
  /** Accessible name for 「확대 ↗」, e.g. which image opens */
  viewLabel?: string
  /** Visible text of the third action; 「열기 ↗」 for artifacts that are not images */
  viewText?: string
  /** Cell only: 답장 picks the image as the feedback target (emits `reply`) */
  reply?: boolean
  /** Accessible names, e.g. 「히어로 B에 답장」 · 「od 세션 멈춤」 */
  replyLabel?: string
  pauseLabel?: string
  /** Gallery: keep it visible without hover */
  shown?: boolean
}>(), { variant: 'cell', viewText: '확대 ↗' })

defineEmits<{ view: [], reply: [] }>()
</script>

<template>
  <div class="floating-actions" :class="[`on-${variant}`, { shown }]">
    <button v-if="reply && variant === 'cell'" type="button" :aria-label="replyLabel" @click="$emit('reply')">
      답장
    </button>
    <!-- Replying from a message is a later track: drawn, never sent -->
    <button v-else type="button" disabled>
      답장
    </button>
    <!-- Pausing is a later track. On a cell it stays in the Tab order (guide 04: four
         stops per cell), so it is aria-disabled rather than disabled. -->
    <button v-if="variant === 'cell'" type="button" class="off" aria-disabled="true" :aria-label="pauseLabel">
      멈춤
    </button>
    <button v-else type="button" disabled>
      멈춤
    </button>
    <button v-if="variant === 'cell'" type="button" :aria-label="viewLabel" @click="$emit('view')">
      {{ viewText }}
    </button>
  </div>
</template>

<style scoped>
.floating-actions {
  position: absolute;
  z-index: var(--z-message-actions);
  display: flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  opacity: 0;
  /* Hidden buttons must not catch taps on the cell under them */
  pointer-events: none;
  transition: opacity 0.15s;
}
.floating-actions.shown {
  opacity: 1;
  pointer-events: auto;
}
.on-cell {
  bottom: 49px;
  right: 9px;
  box-shadow: 0 3px 14px var(--shade);
}
/* Fully above the message head so the time stays readable */
.on-message {
  top: -40px;
  right: 0;
  box-shadow: 0 3px 9px var(--shade);
}
button {
  min-height: 36px;
  padding: 0 9px;
  border-radius: 9px;
  font-size: 11px;
  white-space: nowrap;
}
/* Drawn inside the bar so its edge does not clip the ring (OD stream guide 04-02) */
button:focus-visible {
  outline-offset: -2px;
}
.off {
  cursor: default;
  opacity: 0.55;
}
.off:hover {
  background: none;
  color: inherit;
}
.on-message button {
  min-height: 32px;
  padding: 0 10px;
  font-size: 10px;
}

@media (pointer: coarse) {
  button,
  .on-message button {
    min-width: 44px;
    min-height: 44px;
  }
}
@media (max-width: 767px) {
  .on-message {
    display: none;
  }
}
</style>

<style>
/* Unscoped: the host decides when the bar shows */
[data-floating-host]:hover > .floating-actions,
[data-floating-host]:focus-within > .floating-actions {
  opacity: 1;
  pointer-events: auto;
}
</style>
