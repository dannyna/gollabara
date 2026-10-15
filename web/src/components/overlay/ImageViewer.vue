<script setup lang="ts">
import type { Artifact } from '../../artifacts'
import type { ZoomState } from './zoom'
import { computed, ref, watch } from 'vue'
import { middleTruncate } from '../../../../src/shared/stacks'
import { atVersion, clock, sourceName } from '../../artifacts'
import { useCaptures } from '../../captures'
import OverlayIcon from './OverlayIcon.vue'
import { feedbackTargetOf, useFeedbackTarget } from './useFeedbackTarget'
import { useImageViewer } from './useImageViewer'
import { useOverlay } from './useOverlay'
import { MAX_ZOOM, MIN_ZOOM, setZoom, ZOOM_STEP, zoomLabel } from './zoom'

// Full-screen viewer. Images are shown as they arrived, ratio kept, never cropped.
// A cell that hides earlier captures of the same screen pages through them here,
// oldest → newest, starting at the newest.

const props = defineProps<{
  items: Artifact[]
  /** Key of the artifact on screen; tracked by key so new arrivals do not shift it */
  modelValue: string
  /** Gallery: static rendering with no focus moves or keys */
  preview?: boolean
  /** Gallery: start zoomed in */
  initialZoom?: number
  /** Gallery: open on this capture (0 = oldest) instead of the newest */
  initialVersion?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [key: string | null] }>()

const panel = ref<HTMLElement>()
const closeButton = ref<HTMLButtonElement>()
const close = () => emit('update:modelValue', null)

useOverlay({
  panel,
  close,
  trap: true,
  lockScroll: true,
  initialFocus: () => closeButton.value,
  enabled: !props.preview,
})

const index = computed(() => props.items.findIndex(a => a.key === props.modelValue))
const item = computed(() => props.items[index.value])
// The artifact left the view (muted, or scope changed): nothing to show
watch(item, (a) => {
  if (!a)
    close()
}, { immediate: true })

const pad = (n: number) => String(n).padStart(2, '0')
const position = computed(() => `${pad(index.value + 1)} / ${pad(props.items.length)}`)

// Which capture of the cell is on screen; every cell opens on its newest
const versions = computed(() => item.value?.versions ?? [])
// A chat thumbnail of an older capture opens on that capture
const { openCapture } = useImageViewer()
function startVersion() {
  const asked = versions.value.findIndex(v => v.key === openCapture.value)
  // Used once: moving to another cell starts on its newest
  openCapture.value = null
  return asked >= 0 ? asked : Math.max(0, versions.value.length - 1)
}
const versionIndex = ref(props.initialVersion ?? startVersion())
watch(() => props.modelValue, () => versionIndex.value = startVersion())
// A new capture arriving while the newest is on screen keeps the newest on screen
watch(() => versions.value.length, (n, prev) => {
  if (versionIndex.value >= (prev ?? 0) - 1)
    versionIndex.value = Math.max(0, n - 1)
})
const shown = computed(() => {
  const v = versions.value[versionIndex.value]
  return item.value && v ? atVersion(item.value, v) : item.value
})
const file = computed(() => shown.value && sourceName(shown.value))
function page(step: number) {
  const next = versionIndex.value + step
  if (next >= 0 && next < versions.value.length)
    versionIndex.value = next
}

// 「따로 보기」: the capture on screen gets its own cell, and the viewer follows it there
const { splitOff } = useCaptures()
function separate() {
  const v = versions.value[versionIndex.value]
  if (!v)
    return
  splitOff(v.key)
  emit('update:modelValue', v.key)
}

function go(step: number) {
  const next = props.items[index.value + step]
  if (next)
    emit('update:modelValue', next.key)
}

// Zoom and pan; a new image starts at 100%
const view = ref<ZoomState>(setZoom({ zoom: 1, x: 0, y: 0 }, props.initialZoom ?? 1))
watch(() => shown.value?.url, () => view.value = setZoom(view.value, MIN_ZOOM))
const zoomBy = (delta: number) => view.value = setZoom(view.value, view.value.zoom + delta)
const transform = computed(() => `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.zoom})`)

// Pinch with two pointers, drag to pan when zoomed
const pointers = new Map<number, { x: number, y: number }>()
let gesture: { distance: number, zoom: number } | { x: number, y: number, panX: number, panY: number } | null = null
function spread() {
  const [a, b] = [...pointers.values()]
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0
}
function onPointerdown(e: PointerEvent) {
  if ((e.target as Element).closest('button'))
    return
  const stage = e.currentTarget as Element
  stage.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  gesture = pointers.size === 2
    ? { distance: spread(), zoom: view.value.zoom }
    : { x: e.clientX, y: e.clientY, panX: view.value.x, panY: view.value.y }
}
function onPointermove(e: PointerEvent) {
  if (!pointers.has(e.pointerId) || !gesture)
    return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if ('distance' in gesture) {
    if (gesture.distance)
      view.value = setZoom(view.value, gesture.zoom * spread() / gesture.distance)
  }
  else if (view.value.zoom > MIN_ZOOM) {
    view.value = { ...view.value, x: gesture.panX + e.clientX - gesture.x, y: gesture.panY + e.clientY - gesture.y }
  }
}
function onPointerup(e: PointerEvent) {
  pointers.delete(e.pointerId)
  gesture = null
}
function onWheel(e: WheelEvent) {
  // Ctrl + wheel, which is also what trackpad pinches send
  if (!e.ctrlKey)
    return
  e.preventDefault()
  view.value = setZoom(view.value, view.value.zoom - e.deltaY * 0.008)
}

const { setTarget } = useFeedbackTarget()
function giveFeedback() {
  // The capture on screen, not necessarily the newest
  setTarget(feedbackTargetOf(shown.value!))
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    go(-1)
  }
  else if (e.key === 'ArrowRight') {
    go(1)
  }
  else if (e.key === 'ArrowUp' && versions.value.length) {
    e.preventDefault()
    page(-1)
  }
  else if (e.key === 'ArrowDown' && versions.value.length) {
    e.preventDefault()
    page(1)
  }
}
</script>

<template>
  <section
    v-if="item" ref="panel" class="viewer" role="dialog" aria-modal="true" aria-label="이미지 크게 보기"
    @keydown="onKeydown"
  >
    <div class="viewer-bar">
      <button ref="closeButton" class="icon-button" type="button" aria-label="뷰어 닫기" @click="close">
        <OverlayIcon name="close" />
      </button>
      <div class="viewer-title">
        {{ item.session }}<span v-if="item.branch"> · {{ item.branch }}</span>
        <small>{{ clock(shown!.at) }}<template v-if="file"> · <span :title="shown!.source">{{ middleTruncate(file, 40) }}</span></template> · {{ shown!.width }} × {{ shown!.height }}</small>
      </div>
      <div class="viewer-tools">
        <button class="icon-button" type="button" aria-label="축소" :disabled="view.zoom <= MIN_ZOOM" @click="zoomBy(-ZOOM_STEP)">
          <OverlayIcon name="minus" />
        </button>
        <button class="text-button mono" type="button" aria-label="확대 초기화" @click="view = setZoom(view, MIN_ZOOM)">
          {{ zoomLabel(view.zoom) }}
        </button>
        <button class="icon-button" type="button" aria-label="확대" :disabled="view.zoom >= MAX_ZOOM" @click="zoomBy(ZOOM_STEP)">
          <OverlayIcon name="plus" />
        </button>
      </div>
    </div>

    <div
      class="viewer-stage" :class="{ zoomed: view.zoom > MIN_ZOOM }"
      @pointerdown="onPointerdown" @pointermove="onPointermove" @pointerup="onPointerup" @pointercancel="onPointerup"
      @wheel="onWheel"
    >
      <img :src="shown!.url" :alt="file ?? item.label ?? `${item.session} 이미지`" :style="{ transform }" draggable="false">
      <!-- At either end the arrow turns off; it never wraps around -->
      <button class="icon-button viewer-nav viewer-prev" type="button" aria-label="이전 이미지" :disabled="index <= 0" @click="go(-1)">
        <OverlayIcon name="left" />
      </button>
      <button
        class="icon-button viewer-nav viewer-next" type="button" aria-label="다음 이미지"
        :disabled="index >= items.length - 1" @click="go(1)"
      >
        <OverlayIcon name="right" />
      </button>
    </div>

    <div class="viewer-bottom">
      <p>
        <span class="mono">{{ position }}</span><br>
        <span>{{ item.label ?? '이미지' }}</span>
      </p>
      <div v-if="versions.length" class="versions" role="group" aria-label="같은 화면의 다른 캡처" aria-keyshortcuts="ArrowUp ArrowDown">
        <button class="icon-button" type="button" aria-label="이전 캡처" :disabled="versionIndex <= 0" @click="page(-1)">
          <OverlayIcon name="left" />
        </button>
        <span class="mono" aria-live="polite">{{ versionIndex + 1 }} / {{ versions.length }} · 같은 화면</span>
        <button class="icon-button" type="button" aria-label="다음 캡처" :disabled="versionIndex >= versions.length - 1" @click="page(1)">
          <OverlayIcon name="right" />
        </button>
        <button class="text-button" type="button" @click="separate">
          따로 보기
        </button>
      </div>
      <!-- Picks the image for the composer; delivery happens there, not here -->
      <button class="secondary" type="button" @click="giveFeedback">
        이 이미지에 피드백 ↗
      </button>
    </div>
  </section>
</template>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  z-index: var(--z-viewer);
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.viewer-bar {
  height: 74px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 25px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.viewer-title {
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.viewer-title small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font: 10px var(--mono);
  font-variant-numeric: tabular-nums;
}
.viewer-tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.viewer-tools .text-button {
  min-width: 56px;
}
.viewer-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 70px;
  overflow: hidden;
  touch-action: none;
}
.viewer-stage.zoomed {
  cursor: grab;
}
.viewer-stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 10px 40px var(--shade);
  transform-origin: center;
  user-select: none;
  pointer-events: none;
}
.viewer-nav {
  position: absolute;
  top: 50%;
  z-index: var(--z-pill);
  transform: translateY(-50%);
  border: 1px solid var(--border);
  background: var(--surface);
}
.viewer-prev {
  left: 18px;
}
.viewer-next {
  right: 18px;
}
.viewer-bottom {
  min-height: 64px;
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 25px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.viewer-bottom p {
  min-width: 0;
  color: var(--muted);
  font-size: 11px;
}
.versions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--muted);
}
.versions .mono {
  padding: 0 4px;
  font-size: 10px;
  white-space: nowrap;
}
.versions .text-button {
  margin-left: 6px;
}

@media (max-width: 767px) {
  .viewer-bar {
    height: 68px;
    padding: 0 10px;
    gap: 4px;
  }
  .viewer-title {
    font-size: 10px;
  }
  .viewer-title small {
    font-size: 9px;
  }
  .viewer-tools {
    gap: 0;
  }
  .viewer-tools .text-button {
    min-width: 44px;
    padding: 0 5px;
  }
  .viewer-stage {
    padding: 16px 36px;
  }
  .viewer-nav {
    border-radius: 5px;
    opacity: 0.9;
  }
  .viewer-prev {
    left: 2px;
  }
  .viewer-next {
    right: 2px;
  }
  .viewer-bottom {
    padding: 11px 14px calc(11px + env(safe-area-inset-bottom));
  }
  .viewer-bottom p {
    font-size: 10px;
  }
  /* The capture pager takes its own row under the caption */
  .viewer-bottom {
    flex-wrap: wrap;
  }
  .versions {
    order: 3;
    width: 100%;
    margin-left: 0;
  }
  .viewer-bottom .secondary {
    font-size: 11px;
  }
}
</style>
