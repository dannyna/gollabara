<script setup lang="ts">
// The stream's bottom row (OD stream guide 01, banner guide 06): a muted standing note on
// the left, the follow state (or the pin) on the right. Always in the same place, never yellow.

import type { Follow } from './follow'
import { followText } from './follow'

defineProps<{ follow: Follow, pinned?: boolean }>()
</script>

<template>
  <div class="stream-footer">
    <span><i class="dot" />이미지는 원래 비율 그대로</span>
    <span class="mono">{{ followText(follow, !!pinned) }}</span>
  </div>
</template>

<style scoped>
.stream-footer {
  height: 48px;
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0 26px;
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
}
.dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-right: 7px;
  border-radius: 50%;
  background: var(--muted);
}

@media (min-width: 768px) and (max-width: 1023px) {
  .stream-footer {
    height: 27px;
    padding: 0 22px;
  }
}
</style>
