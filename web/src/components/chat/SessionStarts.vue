<script setup lang="ts">
import type { StartRow } from './chat'
import { computed, ref } from 'vue'
import { clock } from '../../artifacts'
import { useNameHints } from '../../names'
import { STARTS_SHOWN } from './chat'
import ChatIcon from './ChatIcon.vue'
import SessionName from './SessionName.vue'

// 「… 시작」 rows, left-aligned in the message column. Sessions that start together sit 2px
// apart; past three, the rest fold into 「외 n개」.
const props = defineProps<{
  rows: StartRow[]
  /** The next item is one of these sessions' messages: an 8px gap instead of 20px */
  lead?: boolean
}>()
const { hintOf } = useNameHints()
const expanded = ref(false)
const folded = computed(() => !expanded.value && props.rows.length > STARTS_SHOWN)
const shown = computed(() => folded.value ? props.rows.slice(0, STARTS_SHOWN) : props.rows)
</script>

<template>
  <div class="starts" :class="{ lead }">
    <div v-for="row in shown" :key="row.key" class="start-row">
      <span class="start-icon"><ChatIcon name="start" /></span>
      <SessionName :name="row.name" :hint="hintOf(row.sessionId)" class="name" />
      <span class="verb">시작</span>
      <time>{{ clock(row.at) }}</time>
    </div>
    <button v-if="folded" type="button" class="more" @click="expanded = true">
      외 {{ rows.length - STARTS_SHOWN }}개
    </button>
  </div>
</template>

<style scoped>
.starts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 0 20px;
}
.starts.lead {
  margin-bottom: 8px;
}
.start-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 24px;
  font-size: 11px;
  color: var(--muted);
}
.start-icon {
  width: 23px;
  height: 23px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px dashed var(--border);
  border-radius: 6px;
}
.start-row .start-icon .chat-icon {
  width: 12px;
  height: 12px;
}
.name {
  font-weight: 500;
  color: var(--fg);
}
.verb {
  flex: none;
}
time {
  margin-left: auto;
  flex: none;
  font: 9px var(--mono);
}
.more {
  align-self: flex-start;
  min-height: 24px;
  margin-left: 31px;
  padding: 0;
  font-size: 10.5px;
  color: var(--muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.more:hover:not(:disabled) {
  background: none;
  color: var(--fg);
}
@media (max-width: 767px), (pointer: coarse) {
  .more {
    min-height: 44px;
  }
}
</style>
