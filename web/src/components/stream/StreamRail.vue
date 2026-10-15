<script setup lang="ts">
// The rail (OD stream guide 01 · 03): one horizontal scroller, every visible artifact in
// arrival order with sessions interleaved. Runs and dividers come from `runStart`, which
// toArtifacts works out between visible neighbours only, so muting or scoping redraws them.
//
// The wheel, a trackpad swipe, and ←/→ move one cell at a time and land its left edge on
// the anchor, the rail's left padding (step.ts). Touch keeps native momentum scrolling.
//
// Inside the stream panel the panel is the size container. `bare` makes the rail its own
// container, for a rail without heading or footer (the component gallery).

import type { Artifact } from '../../artifacts'
import { onBeforeUnmount, ref } from 'vue'
import { alignTarget, SETTLE_FALLBACK_MS, stepTarget, WHEEL_QUIET_MS, WHEEL_STEP_PX, wheelDelta } from './step'
import StreamCell from './StreamCell.vue'

defineProps<{
  artifacts: Artifact[]
  selected?: string | null
  bare?: boolean
}>()
const emit = defineEmits<{ select: [key: string], open: [key: string], reply: [artifact: Artifact], step: [] }>()

const el = ref<HTMLElement>()

function geometry() {
  const rail = el.value!
  const box = rail.getBoundingClientRect()
  const starts = [...rail.querySelectorAll<HTMLElement>(':scope > .cell')].map(c => c.getBoundingClientRect().left - box.left + rail.scrollLeft)
  return { rail, starts, anchor: Number.parseFloat(getComputedStyle(rail).paddingLeft) || 0, max: rail.scrollWidth - rail.clientWidth }
}

const behavior = (): ScrollBehavior => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'

// One step per gesture: input is ignored until the scroll settles and the wheel goes quiet
let locked = false
let travel = 0
let lastWheel = 0
let timer: ReturnType<typeof setTimeout> | undefined
function settle() {
  clearTimeout(timer)
  el.value?.removeEventListener('scrollend', settle)
  const wait = WHEEL_QUIET_MS - (performance.now() - lastWheel)
  if (wait > 0)
    timer = setTimeout(settle, wait)
  else
    locked = false
}

function step(dir: 1 | -1) {
  if (!el.value)
    return
  const { rail, starts, anchor, max } = geometry()
  const left = stepTarget(rail.scrollLeft, starts, dir, anchor, max)
  if (left === null)
    return
  locked = true
  travel = 0
  emit('step')
  rail.addEventListener('scrollend', settle, { once: true })
  clearTimeout(timer)
  timer = setTimeout(settle, SETTLE_FALLBACK_MS)
  rail.scrollTo({ left, behavior: behavior() })
}

function onWheel(e: WheelEvent) {
  // Ctrl + wheel is pinch or page zoom
  if (e.ctrlKey)
    return
  e.preventDefault()
  const now = performance.now()
  if (now - lastWheel > WHEEL_QUIET_MS)
    travel = 0
  lastWheel = now
  if (locked)
    return
  travel += wheelDelta(e, el.value!.clientWidth)
  if (Math.abs(travel) >= WHEEL_STEP_PX)
    step(travel > 0 ? 1 : -1)
}

function onKeydown(e: KeyboardEvent) {
  if (e.target !== el.value || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight'))
    return
  e.preventDefault()
  if (!locked)
    step(e.key === 'ArrowRight' ? 1 : -1)
}

/** Puts one cell on the anchor, e.g. when its chat thumbnail is picked */
function align(key: string, how: ScrollBehavior = behavior()) {
  const cell = el.value?.querySelector<HTMLElement>(`:scope > [data-key="${CSS.escape(key)}"]`)
  if (!cell)
    return
  const { rail, anchor, max } = geometry()
  const start = cell.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft
  rail.scrollTo({ left: alignTarget(start, anchor, max), behavior: how })
}

onBeforeUnmount(() => clearTimeout(timer))
defineExpose({ el, align })
</script>

<template>
  <div
    ref="el" class="rail" :class="{ bare }" tabindex="0" aria-label="가로로 스크롤하는 산출물 스트림"
    @wheel="onWheel" @keydown="onKeydown"
  >
    <StreamCell
      v-for="a in artifacts" :key="a.key" :artifact="a" :selected="selected === a.key"
      @select="emit('select', a.key)" @open="emit('open', a.key)" @reply="emit('reply', a)"
    />
  </div>
</template>

<style scoped>
.rail {
  /* Cells in one run sit close; StreamCell adds the rest back where a run starts */
  --cell-gap: 22px;
  --run-gap: 10px;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: var(--run-gap);
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
    --cell-gap: 18px;
    padding: 0 22px 6px;
  }
  .bare {
    --stream-chrome: 59px;
    --cell-gap: 22px;
    padding: 14px 22px 12px;
  }
}
</style>
