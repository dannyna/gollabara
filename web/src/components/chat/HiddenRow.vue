<script setup lang="ts">
import type { HiddenLine } from '../../triage'
import type { IconName } from './icons'
import { computed } from 'vue'
import { clock } from '../../artifacts'
import ChatIcon from './ChatIcon.vue'

// 「숨긴 메시지 n」 where triage hid lines: folded in place, so the reader sees where lines
// dropped out. Expanded lines are muted 11px text inside a hairline, with no avatar or state.
// The same row folds reference images (「참고 이미지 n」): `label`, `icon` and `times` name
// what it holds, and the default slot draws them when it opens.
const props = defineProps<{
  lines?: HiddenLine[]
  /** Inside a message, between lines of one turn */
  inset?: boolean
  label?: string
  icon?: IconName
  /** When each folded item arrived, for the count and the time span; defaults to the lines' */
  times?: number[]
}>()
const open = defineModel<boolean>({ default: false })

const times = computed(() => props.times ?? props.lines?.map(l => l.at) ?? [])
const span = computed(() => {
  const first = clock(Math.min(...times.value))
  const last = clock(Math.max(...times.value))
  return first === last ? first : `${first}–${last}`
})
</script>

<template>
  <button type="button" class="hidden-row" :class="{ inset }" :aria-expanded="open" @click="open = !open">
    <span class="row-icon"><ChatIcon :name="icon ?? 'eyeoff'" /></span>
    <span>{{ label ?? '숨긴 메시지' }} <span class="count">{{ times.length }}</span>{{ open ? ' 접기' : '' }}</span>
    <ChatIcon name="chev" class="chev" />
    <time v-if="!inset && times.length" class="span">{{ span }}</time>
  </button>
  <div v-if="open" class="hidden-list" :class="{ inset }">
    <slot>
      <p v-for="line in lines" :key="line.key" class="hidden-item">
        <span class="who">{{ line.sessionName }} · {{ clock(line.at) }}</span>{{ line.text }}
      </p>
    </slot>
  </div>
</template>

<style scoped>
.hidden-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  margin: -6px 0 14px;
  padding: 0 8px 0 0;
  border-radius: 8px;
  color: var(--muted);
  font-size: 10.5px;
  text-align: left;
}
.hidden-row:hover:not(:disabled) {
  color: var(--fg);
  background: color-mix(in oklab, var(--fg) 5%, transparent);
}
.row-icon {
  width: 23px;
  flex: none;
  display: grid;
  place-items: center;
}
.hidden-row .row-icon .chat-icon {
  width: 14px;
  height: 14px;
}
.count {
  font: 500 10px var(--mono);
  font-variant-numeric: tabular-nums;
}
.hidden-row .chev {
  width: 12px;
  height: 12px;
  transition: transform 0.15s;
}
.hidden-row[aria-expanded='true'] .chev {
  transform: rotate(180deg);
}
.span {
  margin-left: auto;
  font: 9px var(--mono);
}
.hidden-list {
  margin: -10px 0 18px 11px;
  padding: 2px 0 2px 19px;
  border-left: 1px solid var(--border);
}
.hidden-item {
  padding: 4px 0;
  font-size: 11px;
  line-height: 1.65;
  color: var(--muted);
}
.who {
  display: block;
  font: 400 9px var(--mono);
}
.hidden-row.inset {
  width: calc(100% + var(--indent, 31px));
  margin: 2px 0 0 calc(-1 * var(--indent, 31px));
}
.hidden-list.inset {
  margin: 2px 0 0 calc(11px - var(--indent, 31px));
}
@media (pointer: coarse) {
  .hidden-row {
    min-height: 44px;
  }
}
</style>
