<script setup lang="ts">
import type { IconName } from './icons'
import { ICONS } from './icons'

defineProps<{ name: IconName }>()
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- static paths from icons.ts -->
  <svg class="chat-icon" viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS[name]" />
</template>

<style scoped>
.chat-icon {
  display: block;
  flex: none;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
