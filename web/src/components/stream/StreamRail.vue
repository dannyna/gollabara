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

import type { Artifact, ReferenceFold as Fold } from '../../artifacts'
import type { Wheel } from './step'
import { computed, onBeforeUnmount, ref } from 'vue'
import ReferenceFold from './ReferenceFold.vue'
import { alignTarget, SETTLE_FALLBACK_MS, stepTarget, wheelDelta, wheelInput, wheelSettled } from './step'
import StreamCell from './StreamCell.vue'

const props = defineProps<{
  artifacts: Artifact[]
  /** 「참고 이미지 n」 folds, each drawn after the cell it follows (referenceFolds) */
  folds?: Fold[]
  selected?: string | null
  pinned?: string | null
  bare?: boolean
}>()

const emit = defineEmits<{ select: [key: string], open: [key: string], reply: [artifact: Artifact], step: [left: number] }>()
const foldsAfter = computed(() => {
  const map = new Map<string | null, Fold[]>()
  for (const f of props.folds ?? []) map.set(f.after, [...map.get(f.after) ?? [], f])
  return map
})
/** Open folds, by key; a fold keeps its first reference's key as it grows */
const openFolds = ref(new Set<string>())
function toggleFold(key: string, open: boolean) {
  const next = new Set(openFolds.value)
  if (open)
    next.add(key)
  else
    next.delete(key)
  openFolds.value = next
}
const el = ref<HTMLElement>()

function geometry() {
  const rail = el.value!
  const box = rail.getBoundingClientRect()
  const cells = [...rail.querySelectorAll<HTMLElement>(':scope > .cell')]
  const starts = cells.map(c => c.getBoundingClientRect().left - box.left + rail.scrollLeft)
  return { rail, cells, starts, anchor: Number.parseFloat(getComputedStyle(rail).paddingLeft) || 0, max: rail.scrollWidth - rail.clientWidth }
}

const behavior = (): ScrollBehavior => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'

// The cell a step is scrolling to, until its scroll settles. A step taken meanwhile goes
// on from this cell rather than from the half-way scroll position, so it is never lost.
let aim: string | undefined
let wheel: Wheel | undefined
let timer: ReturnType<typeof setTimeout> | undefined

function aimLeft() {
  const cell = aim && el.value?.querySelector<HTMLElement>(`:scope > [data-key="${CSS.escape(aim)}"]`)
  if (!cell)
    return null
  const { rail, anchor, max } = geometry()
  return alignTarget(cell.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft, anchor, max)
}

function settle() {
  clearTimeout(timer)
  el.value?.removeEventListener('scrollend', onScrollEnd)
  aim = undefined
  // Wheel input that keeps coming, other than a momentum tail, may step again
  wheel = wheelSettled(wheel)
}
function onScrollEnd() {
  // Another scroll (a cell arriving, a realign) can end first; the step settles on its cell
  const left = aimLeft()
  if (left === null || Math.abs(el.value!.scrollLeft - left) <= 1)
    settle()
}
function track(left: number) {
  el.value!.addEventListener('scrollend', onScrollEnd)
  clearTimeout(timer)
  timer = setTimeout(settle, SETTLE_FALLBACK_MS)
  el.value!.scrollTo({ left, behavior: behavior() })
}

function step(dir: 1 | -1) {
  if (!el.value)
    return
  const { rail, cells, starts, anchor, max } = geometry()
  const left = stepTarget(aimLeft() ?? rail.scrollLeft, starts, dir, anchor, max)
  if (left === null)
    return
  aim = cells[starts.findIndex(s => Math.abs(alignTarget(s, anchor, max) - left) <= 1)]?.dataset.key
  emit('step', left)
  track(left)
}

function onWheel(e: WheelEvent) {
  // Ctrl + wheel is pinch or page zoom
  if (e.ctrlKey)
    return
  e.preventDefault()
  const read = wheelInput(wheel, performance.now(), wheelDelta(e, el.value!.clientWidth))
  wheel = read.wheel
  if (read.dir)
    step(read.dir)
}

function onKeydown(e: KeyboardEvent) {
  if (e.target !== el.value || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight'))
    return
  e.preventDefault()
  // A held key repeats faster than a step scrolls: one step at a time
  if (aim === undefined)
    step(e.key === 'ArrowRight' ? 1 : -1)
}

/** Cells moved under a step in flight (an arrival): carries it on to its cell. False when none is */
function realign() {
  const left = aimLeft()
  if (left === null)
    return false
  track(left)
  return true
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
defineExpose({ el, align, realign })
</script>

<template>
  <div
    ref="el" class="rail" :class="{ bare }" tabindex="0" aria-label="가로로 스크롤하는 산출물 스트림"
    @wheel="onWheel" @keydown="onKeydown"
  >
    <ReferenceFold
      v-for="f in foldsAfter.get(null)" :key="f.key" :fold="f" :model-value="openFolds.has(f.key)"
      @update:model-value="toggleFold(f.key, $event)" @open="emit('open', $event)" @reply="emit('reply', $event)"
    />
    <template v-for="a in artifacts" :key="a.key">
      <StreamCell
        :artifact="a" :selected="selected === a.key" :pinned="pinned === a.key"
        @select="emit('select', a.key)" @open="emit('open', a.key)" @reply="emit('reply', a)"
      />
      <ReferenceFold
        v-for="f in foldsAfter.get(a.key)" :key="f.key" :fold="f" :model-value="openFolds.has(f.key)"
        @update:model-value="toggleFold(f.key, $event)" @open="emit('open', $event)" @reply="emit('reply', $event)"
      />
    </template>
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
