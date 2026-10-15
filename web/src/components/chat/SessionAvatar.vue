<script setup lang="ts">
import { sessionInitial } from './chat'

defineProps<{
  name: string
  /** 17px, for the queue tray and the composer's target chip */
  small?: boolean
  /** The session ended: a dashed outline in place of the fill, like a start row's square */
  ended?: boolean
}>()
</script>

<template>
  <span class="session-avatar" :class="{ small, ended }" aria-hidden="true">{{ sessionInitial(name) }}</span>
</template>

<style scoped>
.session-avatar {
  width: 23px;
  height: 23px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--bg);
  font: 600 11px var(--display);
}
.session-avatar.ended {
  background: transparent;
  outline: 1px dashed var(--border);
  outline-offset: -1px;
  color: var(--muted);
}
.session-avatar.small {
  width: 17px;
  height: 17px;
  border-radius: 5px;
  font-size: 9px;
}
@media (max-width: 767px) {
  .session-avatar:not(.small) {
    width: 22px;
    height: 22px;
  }
}
</style>
