<script setup lang="ts">
defineProps<{ name: keyof typeof PATHS | 'alert' }>()

// Line icons from the OD guide, drawn on a 24 grid
const PATHS = {
  close: 'm6 6 12 12M6 18 18 6',
  left: 'm15 6-6 6 6 6',
  right: 'm9 6 6 6-6 6',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
} as const
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <template v-if="name === 'alert'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </template>
    <path v-else :d="PATHS[name]" />
  </svg>
</template>
