<script setup lang="ts">
// 「참고 이미지 n」 on the rail: images the session only looked at (a mock, an existing asset,
// an older screenshot), folded between the artifact cells they arrived between, like
// 「숨긴 메시지 n」 in chat. Open, they follow the fold as muted cells. Neither the fold nor its
// cells are direct `.cell` / `[data-key]` children of the rail, so wheel steps, the pin and
// the follow hold pass them by.

import type { Artifact, ReferenceFold } from '../../artifacts'
import { computed } from 'vue'
import { clock } from '../../artifacts'
import StreamCell from './StreamCell.vue'

const props = defineProps<{ fold: ReferenceFold }>()
const emit = defineEmits<{ open: [key: string], reply: [artifact: Artifact] }>()
const open = defineModel<boolean>({ default: false })

const span = computed(() => {
  const times = props.fold.items.map(r => r.at)
  const first = clock(Math.min(...times))
  const last = clock(Math.max(...times))
  return first === last ? first : `${first}–${last}`
})
</script>

<template>
  <div class="ref-fold" :class="{ open }">
    <div class="fold-col">
      <p class="meta mono">
        <time>{{ span }}</time>
      </p>
      <button type="button" class="fold-face" :aria-expanded="open" @click="open = !open">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>
        <span>참고 이미지 <span class="count">{{ fold.items.length }}</span></span>
        <span class="toggle">{{ open ? '접기' : '펼치기' }}
          <svg class="icon chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      <div class="caption" />
    </div>
    <template v-if="open">
      <StreamCell
        v-for="r in fold.items" :key="r.key" :artifact="r"
        @open="emit('open', r.key)" @reply="emit('reply', r)"
      />
    </template>
  </div>
</template>

<style scoped>
.ref-fold {
  flex: none;
  display: flex;
  align-items: stretch;
  gap: var(--run-gap, 10px);
}
.fold-col {
  width: 92px;
  display: flex;
  flex-direction: column;
}
.meta {
  height: 48px;
  flex: none;
  display: flex;
  align-items: center;
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
}
.meta time {
  font-size: inherit;
}
.fold-face {
  flex: 1 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.5;
  text-align: center;
}
.fold-face:hover:not(:disabled) {
  color: var(--fg);
  background: color-mix(in oklab, var(--fg) 5%, transparent);
}
.fold-face .icon {
  width: 16px;
  height: 16px;
}
.count {
  font: 500 10px var(--mono);
  font-variant-numeric: tabular-nums;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
}
.toggle .chev {
  width: 12px;
  height: 12px;
  /* Points right, toward where the images open */
  transform: rotate(-90deg);
  transition: transform 0.15s;
}
.open .toggle .chev {
  transform: rotate(90deg);
}
.caption {
  height: 37px;
  flex: none;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .meta {
    height: 35px;
    font-size: 9px;
  }
  .caption {
    height: 24px;
  }
}
</style>
