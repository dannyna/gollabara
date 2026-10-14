<script setup lang="ts">
// Line icons that tell notice kinds apart; color never does (OD banner guide 08).
// Connection is a plug, confirmation a check, failure an exclamation in a circle.
export type BannerIconName = 'plug' | 'check' | 'alert' | 'mute'

defineProps<{ name: BannerIconName }>()
</script>

<template>
  <svg class="banner-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path v-if="name === 'plug'" d="M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4" />
    <path v-else-if="name === 'check'" d="m5 12 5 5 9-10" />
    <template v-else-if="name === 'alert'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </template>
    <path v-else-if="name === 'mute'" d="M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6" />
  </svg>
</template>

<style scoped>
.banner-icon {
  display: block;
  width: 13px;
  height: 13px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
