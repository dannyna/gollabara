<script setup lang="ts">
import { computed } from 'vue'
import { basename, stackCaptures } from '../../../../src/shared/stacks'
import { useCaptures } from '../../captures'
import { outputLabel } from './chat'
import ChatIcon from './ChatIcon.vue'

// The thumbnail row inside a session message: fixed height, original aspect ratio,
// then the tool and count in mono. Re-captures of one screen within the turn show as
// their newest thumbnail only, the same rule the stream uses.
export interface Thumb {
  key: string
  url: string
  width: number
  height: number
  /** Short mark on the thumbnail, e.g. A / B or a sequence number */
  label?: string
  at?: number
  source?: string
  dhash?: string
}

const props = defineProps<{
  thumbs: Thumb[]
  toolName?: string
  /** Key of the thumbnail paired with the stream selection */
  active?: string | null
}>()
const emit = defineEmits<{ pick: [key: string], openImage: [thumb: Thumb] }>()

const { split, cellKey } = useCaptures()
const shown = computed(() => stackCaptures(
  // One turn is one session; images without a time keep their order
  props.thumbs.map((t, i) => ({ ...t, sessionId: '', at: t.at ?? i })),
  split.value,
).map(stack => ({ thumb: stack[stack.length - 1]!, count: stack.length })))

const chip = computed(() => outputLabel(shown.value.length, props.toolName))

// Paired with the stream cell that shows this capture, which may be a newer one
const isActive = (t: Thumb) => props.active != null && (props.active === t.key || props.active === cellKey(t.key))

function title(t: Thumb, count: number) {
  const parts = [t.source && basename(t.source), count > 1 && `같은 화면 ${count}장`].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

// The first press pairs it with the stream, pressing the paired one opens it. Stream cells
// pin instead, so this is the viewer's way in besides a cell's 확대 ↗.
function press(t: Thumb) {
  if (isActive(t))
    emit('openImage', t)
  else
    emit('pick', t.key)
}
</script>

<template>
  <div class="thumbs">
    <button
      v-for="({ thumb: t, count }, i) in shown" :key="t.key" class="thumb" type="button"
      :class="{ active: isActive(t) }" :title="title(t, count)"
      :aria-label="`${t.label ?? (t.source ? basename(t.source) : `이미지 ${i + 1}`)} 선택`"
      @click="press(t)"
    >
      <img :src="t.url" alt="" :style="{ aspectRatio: `${t.width} / ${t.height}` }">
      <span v-if="t.label" class="thumb-label">{{ t.label }}</span>
    </button>
  </div>
  <div class="out-chip">
    <ChatIcon name="image" />{{ chip }}
  </div>
</template>

<style scoped>
.thumbs {
  display: flex;
  gap: 7px;
  overflow: auto;
  margin: 8px 0 5px;
  padding-bottom: 3px;
  scrollbar-width: thin;
}
.thumb {
  position: relative;
  height: 77px;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg);
}
.thumb:hover:not(:disabled) {
  background: var(--bg);
  border-color: var(--muted);
}
.thumb.active {
  outline: 2px solid var(--fg);
  outline-offset: -2px;
}
.thumb img {
  display: block;
  height: 100%;
  width: auto;
}
/* Always light, like a sticker on the image, so it reads on any screenshot */
.thumb-label {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 0 5px;
  border: 1px solid oklch(0.85 0 0);
  border-radius: 6px;
  background: oklch(1 0 0);
  color: var(--ink);
  font: 10px var(--mono);
}
.out-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--muted);
  font: 10px var(--mono);
}
.out-chip .chat-icon {
  width: 12px;
  height: 12px;
}
@media (max-width: 767px) {
  .thumbs {
    gap: 8px;
    margin-top: 9px;
  }
  .thumb {
    height: 120px;
  }
}
</style>
