<script setup lang="ts">
// One short sentence inside the thing it is about: a panel heading, a question card,
// the composer, the stream footer. Everyday hints stay muted in their fixed place; only
// the reason something is blocked rises to fg with an icon. Never red or yellow.
import type { BannerIconName } from './BannerIcon.vue'
import BannerIcon from './BannerIcon.vue'

defineProps<{
  /** `blocked` explains why sending or answering cannot happen right now */
  tone?: 'hint' | 'blocked'
  icon?: BannerIconName
}>()
</script>

<template>
  <span class="inline-note" :class="tone ?? 'hint'">
    <BannerIcon v-if="icon" :name="icon" />
    <span><slot /></span>
  </span>
</template>

<style scoped>
.inline-note {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.hint {
  color: var(--muted);
}
.blocked {
  color: var(--fg);
}
</style>
