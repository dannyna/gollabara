<script setup lang="ts">
import type { IconName } from './icons'
import ChatIcon from './ChatIcon.vue'

// One centred muted line, only for changes the reader needs to know about
defineProps<{ icon: IconName, text: string }>()
</script>

<template>
  <div class="system-line">
    <ChatIcon :name="icon" />{{ text }}
  </div>
</template>

<style scoped>
.system-line {
  margin: 0 0 20px;
  text-align: center;
  font-size: 10px;
  color: var(--muted);
}
.system-line .chat-icon {
  display: inline-block;
  vertical-align: middle;
  width: 11px;
  height: 11px;
  margin-right: 4px;
}
@media (max-width: 767px) {
  .system-line {
    font-size: 9px;
  }
}
</style>
