<script setup lang="ts">
// The stream's bottom row (OD stream guide 01, banner guide 06): a muted standing note on
// the left, the follow state (or the pin) on the right. Always in the same place, never yellow.

import type { Follow } from './follow'
import { FOLLOW_TEXT, HISTORY_TEXT, PINNED_TEXT } from './follow'

/** `history`: a run the reader jumped to (#77), which follows nothing until 「최신으로」 */
defineProps<{ follow: Follow, pinned?: boolean, history?: boolean }>()
</script>

<template>
  <div class="stream-footer">
    <span><i class="dot" />이미지는 원래 비율 그대로</span>
    <span v-if="pinned" class="mono">{{ PINNED_TEXT.lead }} · <b class="how-key">{{ PINNED_TEXT.key }}</b><b class="how-touch">{{ PINNED_TEXT.touch }}</b></span>
    <span v-else-if="history" class="mono">{{ HISTORY_TEXT }}</span>
    <span v-else class="mono">{{ FOLLOW_TEXT[follow] }}</span>
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
/* How to let go of the pin stands out from the muted line, in fg */
b {
  font-weight: 500;
  color: var(--fg);
}
.how-touch {
  display: none;
}
@media (pointer: coarse) {
  .how-key {
    display: none;
  }
  .how-touch {
    display: inline;
  }
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
