<script setup lang="ts">
// Full-width line under a panel heading. The app-bar chip says what the state is; this
// line says what still works meanwhile. At most two sentences and no buttons: an action
// belongs where it happens (a card, the composer). No live region, because the chip
// already announced the state.
</script>

<template>
  <div class="notice-line">
    <slot />
  </div>
</template>

<style scoped>
.notice-line {
  padding: 8px 24px;
  font-size: 11px;
  color: var(--muted);
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
@media (max-width: 767px) {
  .notice-line {
    padding: 7px 16px;
    font-size: 10px;
  }
}
</style>
