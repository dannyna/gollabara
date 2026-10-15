<script setup lang="ts">
// One received artifact on the stream rail (OD stream guide 02): meta · image face ·
// caption, with 답장 · 확대 ↗ on hover or focus. A click on the face selects the
// cell and pins or unpins it (the panel decides); only 확대 ↗ opens the viewer (OD
// message-state guide 04). Only the first cell of a run names the session; later ones keep the row empty so every face stays the same height. The width comes from the
// original ratio and the face height, so the image fills it uncropped (contain).
//
// The face height is the container height minus `--stream-chrome` (the fixed rows
// around it), set by whoever holds the size container: the panel, or a bare rail.
//
// A reference (an image the session only looked at) shows inside an open 「참고 이미지 n」
// fold: muted, with no number, and a click on its face opens the viewer instead of pinning.

import type { Artifact } from '../../artifacts'
import { computed, ref, watch } from 'vue'
import { middleTruncate } from '../../../../src/shared/stacks'
import { artifactCaption, clock, day, sourceName, versionsHint } from '../../artifacts'
import SessionName from '../chat/SessionName.vue'
import FloatingActions from '../overlay/FloatingActions.vue'

const props = defineProps<{
  artifact: Artifact
  selected?: boolean
  /** The rail holds this cell in place while new artifacts arrive */
  pinned?: boolean
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
const reference = computed(() => props.artifact.role === 'reference')
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
// Rejoined so the cell shares the chat's rule: the dir stays whole, only the branch gives way
const sessionName = computed(() => a.value.branch ? `${a.value.session} · ${a.value.branch}` : a.value.session)

// The size is stored with the image, so the cell holds its place before the pixels
// arrive and the rail never shifts when they do
const loaded = ref<'loading' | 'ready' | 'failed'>('loading')
watch(() => a.value.url, () => loaded.value = 'loading')
const state = computed(() => props.face ?? loaded.value)
</script>

<template>
  <article
    class="cell"
    :class="[{ 'run-start': a.runStart && !reference, selected, pinned, reference }, preview && `preview-${preview}`]"
    :style="{ '--ratio': a.width / a.height }" :data-key="a.key" data-floating-host
  >
    <div class="meta">
      <strong :aria-hidden="!a.runStart" :class="{ continued: !a.runStart }"><SessionName :name="sessionName" /></strong>
      <p class="meta-line mono">
        <time><span v-if="a.dayStart" class="day">{{ day(a.at) }} · </span>{{ clock(a.at) }}</time>
        <!-- Narrow cells shorten the stem and keep the extension, so the cut lands mid-name -->
        <span v-if="fileParts" class="file" :title="a.source">
          <span class="stem">{{ fileParts.stem }}</span><span>{{ fileParts.ext }}</span>
        </span>
        <span class="size">{{ sizeLabel ?? `${a.width} × ${a.height}` }}</span>
      </p>
    </div>
    <button v-if="reference" class="hit" type="button" :aria-label="`참고 이미지 ${name} 크게 보기`" @click="emit('open')">
      <img :src="a.url" alt="" draggable="false">
    </button>
    <button
      v-else class="hit" type="button" :aria-pressed="!!pinned" :aria-label="pinned ? `${name} 고정됨. 누르면 고정 해제` : `${name} 선택하고 고정`"
      @click="emit('select')"
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
      <span v-if="pinned" class="pin-badge" aria-hidden="true">
        <svg class="icon" viewBox="0 0 24 24"><path d="M9 3.5h6l-1 6.5 3.5 3.5h-11L10 10Z" /><path d="M12 13.5V21" /></svg>
      </span>
    </button>
    <div class="caption">
      <span>{{ reference ? '참고 이미지' : caption }}<span v-if="hint" class="hint"> · {{ hint }}</span></span>
      <span v-if="!reference" class="mono seq">
        <svg v-if="pinned" class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3.5h6l-1 6.5 3.5 3.5h-11L10 10Z" /><path d="M12 13.5V21" /></svg>{{ String(a.seq).padStart(2, '0') }}
      </span>
    </div>
    <FloatingActions
      reply :reply-label="`${name}에 답장`"
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
/* time · file · size; the file's stem gives way in a narrow cell, then the size */
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
/* Floor: the separator, the stem's 1.5em and a short extension; past that the size gives
   way. Clipped, so a longer extension never paints over the size. */
.meta-line .file {
  flex: 0 1 auto;
  display: flex;
  min-width: calc(2.5em + 5ch);
  overflow: hidden;
}
.meta-line .size {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
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
/* The pin badge (OD message-state guide 04): an ink circle in a white ring, so its edge
   reads on light and dark captures alike; yellow stays the selection outline's alone */
.pin-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--ink);
  color: oklch(1 0 0);
  box-shadow:
    0 0 0 2px oklch(1 0 0 / 0.92),
    0 2px 8px oklch(0 0 0 / 0.3);
  pointer-events: none;
}
.pin-badge .icon {
  width: 13px;
  height: 13px;
  stroke-width: 1.8;
}
.caption .seq {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.caption .seq .icon {
  width: 11px;
  height: 11px;
}
.cell.pinned .caption .seq {
  color: var(--fg);
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
/* Muted until pointed at, so a reference never reads as something the session made */
.reference .hit {
  border-color: var(--border);
  border-style: dashed;
  box-shadow: none;
}
.reference .hit img {
  opacity: 0.5;
  filter: saturate(0.4);
  transition: opacity 0.15s;
}
.reference .hit:hover:not(:disabled) img,
.reference .hit:focus-visible img {
  opacity: 1;
  filter: none;
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
