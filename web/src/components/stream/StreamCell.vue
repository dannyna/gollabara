<script setup lang="ts">
// One received artifact on the stream rail (OD stream guide 02): meta · image face ·
// caption, with 답장 · 멈춤 · 확대 ↗ on hover or focus. Only the first cell of a run
// names the session; later ones keep the row empty so every face stays the same height. The width comes from the
// original ratio and the face height, so the image fills it uncropped (contain).
//
// The face height is the container height minus `--stream-chrome` (the fixed rows
// around it), set by whoever holds the size container: the panel, or a bare rail.

import type { Artifact } from '../../artifacts'
import { computed, ref, watch } from 'vue'
import { middleTruncate } from '../../../../src/shared/stacks'
import { artifactCaption, clock, day, sourceName, versionsHint } from '../../artifacts'
import FloatingActions from '../overlay/FloatingActions.vue'

const props = defineProps<{
  artifact: Artifact
  selected?: boolean
  /** Text for the size slot when the artifact has no pixel size, e.g. 「HTML」 */
  sizeLabel?: string
  /** 「열기 ↗」 for artifacts that are not images (guide 07) */
  viewText?: string
  /** Gallery: freeze a pointer or keyboard state that cannot be held still */
  preview?: 'hover' | 'focus' | 'focus-reply'
  /** Gallery: freeze the image face state */
  face?: 'loading' | 'failed'
}>()
const emit = defineEmits<{ select: [], open: [], reply: [] }>()

const a = computed(() => props.artifact)
const caption = computed(() => artifactCaption(a.value))
const file = computed(() => sourceName(a.value))
const hint = computed(() => versionsHint(a.value))
const fileParts = computed(() => {
  if (!file.value)
    return null
  const short = middleTruncate(file.value)
  const dot = short.lastIndexOf('.')
  return dot > 0 ? { stem: short.slice(0, dot), ext: short.slice(dot) } : { stem: short, ext: '' }
})
const name = computed(() => `${a.value.session} ${clock(a.value.at)} ${file.value ?? caption.value}`)

// The size is stored with the image, so the cell holds its place before the pixels
// arrive and the rail never shifts when they do
const loaded = ref<'loading' | 'ready' | 'failed'>('loading')
watch(() => a.value.url, () => loaded.value = 'loading')
const state = computed(() => props.face ?? loaded.value)
</script>

<template>
  <article
    class="cell"
    :class="[{ 'run-start': a.runStart, 'selected': selected }, preview && `preview-${preview}`]"
    :style="{ '--ratio': a.width / a.height }" :data-key="a.key" data-floating-host
  >
    <div class="meta">
      <strong :aria-hidden="!a.runStart" :class="{ continued: !a.runStart }">{{ a.session }}<span v-if="a.branch" class="muted"> · {{ a.branch }}</span></strong>
      <p class="meta-line mono">
        <time><span v-if="a.dayStart" class="day">{{ day(a.at) }} · </span>{{ clock(a.at) }}</time>
        <!-- Narrow cells shorten the stem and keep the extension, so the cut lands mid-name -->
        <span v-if="fileParts" class="file" :title="a.source">
          <span class="stem">{{ fileParts.stem }}</span><span>{{ fileParts.ext }}</span>
        </span>
        <span>{{ sizeLabel ?? `${a.width} × ${a.height}` }}</span>
      </p>
    </div>
    <button
      class="hit" type="button" :aria-pressed="!!selected" :aria-label="`${name} 선택. 다시 누르면 크게 보기`"
      @click="selected ? emit('open') : emit('select')"
    >
      <slot name="face">
        <img
          v-if="state !== 'failed'" :class="{ pending: state === 'loading' }" :src="a.url" alt="" draggable="false"
          @load="loaded = 'ready'" @error="loaded = 'failed'"
        >
        <span v-if="state === 'loading'" class="cell-state">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>
          <span>불러오는 중</span>
        </span>
        <!-- fg, never red, and no invented reason. The cell stays selectable and repliable. -->
        <span v-else-if="state === 'failed'" class="cell-state failed">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
          <span>이미지를 불러오지 못했어요</span>
        </span>
      </slot>
    </button>
    <div class="caption">
      <span>{{ caption }}<span v-if="hint" class="hint"> · {{ hint }}</span></span>
      <span class="mono">{{ String(a.seq).padStart(2, '0') }}</span>
    </div>
    <FloatingActions
      reply :reply-label="`${name}에 답장`" :pause-label="`${a.session} 세션 멈춤`"
      :view-label="`${name} ${viewText ? '열기' : '크게 보기'}`" :view-text="viewText"
      :shown="preview === 'hover' || preview === 'focus' || preview === 'focus-reply'"
      @view="emit('open')" @reply="emit('reply')"
    />
  </article>
</template>

<style scoped>
.cell {
  flex: none;
  position: relative;
  display: flex;
  flex-direction: column;
  width: calc((100cqh - var(--stream-chrome, 209px)) * var(--ratio));
  /* Ratio limits (guide 02-03): a very tall capture keeps a usable face, a very wide one
     never outgrows the rail. contain leaves surface margins; nothing is cropped. */
  min-width: 120px;
  max-width: calc(100cqw - var(--stream-inset, 52px));
  /* Lets the action bar react to a narrow cell */
  container-type: inline-size;
}
/* A new run: another session, a new day, or a pause. The rail's gap is the tight in-run
   one, so this adds back the normal gap plus the divider's 17px. */
.cell.run-start:not(:first-child) {
  margin-left: calc(var(--cell-gap, 22px) - var(--run-gap, 10px) + 17px);
}
.cell.run-start:not(:first-child)::before {
  content: '';
  position: absolute;
  left: -21px;
  top: 0;
  bottom: 10px;
  border-left: 1px dashed var(--border);
}
.meta {
  height: 48px;
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  white-space: nowrap;
}
.meta strong,
.meta-line {
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta strong {
  font-size: 12px;
  font-weight: 500;
}
/* Later cells of a run: the session is named once, at the start */
.meta strong.continued {
  visibility: hidden;
}
.meta-line {
  font-size: 10px;
  color: var(--muted);
}
/* time · file · size; only the file's stem gives way in a narrow cell */
.meta-line {
  display: flex;
  min-width: 0;
}
.meta-line > * {
  flex: none;
}
.meta-line > * + *::before {
  content: '·';
  flex: none;
  padding: 0 0.5em;
}
.meta-line time {
  font-size: inherit;
}
.meta-line .file {
  flex: 0 1 auto;
  display: flex;
  min-width: 0;
}
.file .stem {
  min-width: 1.5em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.caption .hint {
  color: var(--muted);
}
.day {
  color: var(--fg);
  font-weight: 500;
}
.hit {
  display: block;
  position: relative;
  flex: 1 1;
  min-height: 0;
  width: 100%;
  padding: 0;
  /* Transparent until hover or selection, so the state never moves the cell */
  border: 2px solid transparent;
  border-radius: 12px;
  background: var(--surface);
  /* Keep the surface out from under the transparent border, or dark screenshots get a
     light 2px frame in the default state */
  background-clip: padding-box;
  box-shadow: 0 10px 24px oklch(0 0 0 / 0.2);
}
.hit:hover:not(:disabled),
.preview-hover .hit {
  background: var(--surface);
  border-color: var(--muted);
}
/* Yellow on one cell only, kept under the pointer */
.cell.selected .hit,
.cell.selected .hit:hover:not(:disabled) {
  border-color: var(--accent);
}
/* The ring stays fg outside the accent border */
.preview-focus .hit {
  outline: 2px solid var(--fg);
  outline-offset: 3px;
}
.hit img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 10px;
}
.hit img.pending {
  visibility: hidden;
}
.cell-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px;
  border-radius: 10px;
  text-align: center;
  font-size: 11px;
  line-height: 1.5;
  color: var(--muted);
}
.cell-state .icon {
  width: 18px;
  height: 18px;
}
.cell-state.failed {
  color: var(--fg);
}
.caption {
  height: 37px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.caption span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview-focus-reply :deep(.floating-actions button:first-child) {
  outline: 2px solid var(--fg);
  outline-offset: -2px;
}

/* A portrait cell is narrower than the bar: drop it onto the caption row so it covers
   the neighbour's caption, never its image (guide 02-09) */
@container (max-width: 170px) {
  .floating-actions {
    bottom: 0;
  }
}

/* Touch has no hover: the selected cell keeps its actions in reach (guide 04) */
@media (pointer: coarse) {
  .cell.selected > .floating-actions {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .meta {
    height: 35px;
  }
  .meta strong {
    font-size: 10px;
  }
  .meta-line {
    font-size: 9px;
  }
  .caption {
    height: 24px;
    font-size: 9px;
  }
}
</style>
