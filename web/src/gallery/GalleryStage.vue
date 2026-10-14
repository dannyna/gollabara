<script setup lang="ts">
// A box that holds fixed-position overlays: the transform makes it their
// containing block, so a sheet or viewer fills the stage instead of the page.
// The faint surfaces behind stand in for the app.
withDefaults(defineProps<{ height?: number }>(), { height: 560 })
</script>

<template>
  <div class="stage" :style="{ height: `${height}px` }">
    <div class="ghost" aria-hidden="true">
      <i /><i />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  margin: 0 18px;
  overflow: hidden;
  isolation: isolate;
  transform: translateZ(0);
  border-radius: 20px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.ghost {
  position: absolute;
  inset: 0;
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38%;
  gap: 12px;
  pointer-events: none;
}
.ghost i {
  border-radius: 16px;
  background: var(--surface);
}
.ghost i:first-child {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border);
}

@media (max-width: 767px) {
  .stage {
    margin: 0 12px;
  }
  .ghost {
    grid-template-columns: 1fr;
    grid-template-rows: 110px 1fr;
    padding: 0;
  }
  .ghost i {
    border-radius: 0;
  }
}
</style>
