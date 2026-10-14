<script setup lang="ts">
// The rail (OD stream guide 01 · 03): one horizontal scroller, every visible artifact in
// arrival order with sessions interleaved. Dividers come from `sessionStart`, which
// toArtifacts works out between visible neighbours only, so muting or scoping redraws them.
//
// Inside the stream panel the panel is the size container. `bare` makes the rail its own
// container, for a rail without heading or footer (the component gallery).

import type { Artifact } from '../../artifacts'
import { ref } from 'vue'
import StreamCell from './StreamCell.vue'

defineProps<{
  artifacts: Artifact[]
  selected?: string | null
  bare?: boolean
}>()
const emit = defineEmits<{ select: [key: string], open: [key: string], reply: [artifact: Artifact] }>()

const el = ref<HTMLElement>()
defineExpose({ el })
</script>

<template>
  <div ref="el" class="rail" :class="{ bare }" tabindex="0" aria-label="가로로 스크롤하는 산출물 스트림">
    <StreamCell
      v-for="a in artifacts" :key="a.key" :artifact="a" :selected="selected === a.key"
      @select="emit('select', a.key)" @open="emit('open', a.key)" @reply="emit('reply', a)"
    />
  </div>
</template>

<style scoped>
.rail {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 22px;
  padding: 0 26px 18px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.bare {
  container-type: size;
  /* Meta 48 + caption 37; the padding is outside the container's content box */
  --stream-chrome: 85px;
  --stream-inset: 0px;
  padding: 14px 22px 12px;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .rail {
    gap: 18px;
    padding: 0 22px 6px;
  }
  .bare {
    --stream-chrome: 59px;
    padding: 14px 22px 12px;
    gap: 22px;
  }
}
</style>
