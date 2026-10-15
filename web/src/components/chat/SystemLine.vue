<script setup lang="ts">
import type { IconName } from './icons'
import ChatIcon from './ChatIcon.vue'

// One centred muted line, only for changes the reader needs to know about. The `lead` slot
// takes the icon's place: a mute line puts the session's avatar menu button there.
defineProps<{ icon: IconName, text: string }>()
</script>

<template>
  <div class="system-line">
    <span class="line">
      <slot name="lead"><ChatIcon :name="icon" /></slot>{{ text }}
    </span>
  </div>
</template>

<style scoped>
.system-line {
  margin: 0 0 20px;
  text-align: center;
  font-size: 10px;
  color: var(--muted);
}
/* Positioned, so a menu from the lead slot centres under the line */
.line {
  position: relative;
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
