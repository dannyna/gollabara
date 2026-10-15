<script setup lang="ts">
// 「숨긴 메시지 n」 in the chat heading: reveals lines triage hid, inline and dimmed
defineProps<{ count: number }>()
const shown = defineModel<boolean>({ default: false })
</script>

<template>
  <button type="button" class="hidden-toggle" :aria-pressed="shown" @click="shown = !shown">
    숨긴 메시지 <span class="mono">{{ count }}</span>
  </button>
</template>

<style scoped>
.hidden-toggle {
  flex: none;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
}
.hidden-toggle[aria-pressed='true'] {
  border-color: var(--fg);
  color: var(--fg);
}
.mono {
  font: 400 10px var(--mono);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 767px), (pointer: coarse) {
  .hidden-toggle {
    min-height: 44px;
  }
}
</style>
