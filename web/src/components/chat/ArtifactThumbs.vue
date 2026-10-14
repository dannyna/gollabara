<script setup lang="ts">
import { computed } from 'vue'
import { outputLabel } from './chat'
import ChatIcon from './ChatIcon.vue'

// The thumbnail row inside a session message: fixed height, original aspect ratio,
// then the tool and count in mono
export interface Thumb {
  key: string
  url: string
  width: number
  height: number
  /** Short mark on the thumbnail, e.g. A / B or a sequence number */
  label?: string
}

const props = defineProps<{
  thumbs: Thumb[]
  toolName?: string
  /** Key of the thumbnail paired with the stream selection */
  active?: string | null
}>()
const emit = defineEmits<{ pick: [key: string], openImage: [thumb: Thumb] }>()

const chip = computed(() => outputLabel(props.thumbs.length, props.toolName))

// Like a stream cell: the first press pairs it with the stream, pressing the paired one opens it
function press(t: Thumb) {
  if (props.active === t.key)
    emit('openImage', t)
  else
    emit('pick', t.key)
}
</script>

<template>
  <div class="thumbs">
    <button
      v-for="(t, i) in thumbs" :key="t.key" class="thumb" type="button"
      :class="{ active: active === t.key }" :aria-label="`${t.label ?? `이미지 ${i + 1}`} 선택`"
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
