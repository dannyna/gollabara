<script setup lang="ts">
// Takes the content place of an area that has nothing to show: say what is empty and
// where to change it. At most one secondary button, never yellow, and never together
// with a banner in the same area.
//
// Without an icon it is the quiet one-liner the panels already use (「이 세션에는 아직
// 산출물이 없어요.」); with an icon it is the titled view for a cause the user set up,
// such as muting every session.
import type { BannerIconName } from './BannerIcon.vue'
import BannerIcon from './BannerIcon.vue'

defineProps<{
  title: string
  description?: string
  icon?: BannerIconName
  /** Label of the single secondary button */
  action?: string
}>()
defineEmits<{ action: [] }>()
</script>

<template>
  <div class="state-view" :class="{ titled: icon }" role="region" :aria-label="title">
    <BannerIcon v-if="icon" :name="icon" />
    <h3>{{ title }}</h3>
    <p v-if="description">
      {{ description }}
    </p>
    <button v-if="action" class="secondary" type="button" @click="$emit('action')">
      {{ action }}
    </button>
    <!-- More to read under the title, e.g. the first-run guide -->
    <slot />
  </div>
</template>

<style scoped>
.state-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* A guide taller than a short band (tablet) scrolls instead of losing its top */
  justify-content: safe center;
  overflow-y: auto;
  padding: 70px 15px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
}
h3 {
  font-size: inherit;
  font-weight: 400;
}
.titled {
  padding: 24px;
}
.titled .banner-icon {
  width: 26px;
  height: 26px;
  margin-bottom: 12px;
}
.titled h3 {
  color: var(--fg);
  font-size: 13px;
  font-weight: 600;
}
.titled p {
  margin-top: 4px;
  line-height: 1.7;
}
.secondary {
  min-height: 44px;
  margin-top: 16px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--fg);
  font-size: 12px;
}
.secondary:hover:not(:disabled) {
  background: var(--surface);
  border-color: var(--fg);
}
</style>
