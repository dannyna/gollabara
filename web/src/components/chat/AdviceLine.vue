<script setup lang="ts">
import ChatIcon from './ChatIcon.vue'

// The advisor's note under a message: a muted sentence, and optionally a draft reply as a
// chip. Tapping the chip only fills the composer; nothing is sent until the user sends it.
defineProps<{
  advice?: string
  draft?: string
}>()
const emit = defineEmits<{ draft: [text: string] }>()
</script>

<template>
  <div v-if="advice || draft" class="advice">
    <p v-if="advice" class="advice-text">
      <ChatIcon name="hint" />
      <span>{{ advice }}</span>
    </p>
    <button v-if="draft" type="button" class="draft-chip" :title="draft" @click="emit('draft', draft)">
      <ChatIcon name="reply" />
      <span class="draft-label">초안</span>
      <span class="draft-text">{{ draft }}</span>
    </button>
  </div>
</template>

<style scoped>
.advice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin: 4px 0 8px;
}
.advice-text {
  display: flex;
  gap: 5px;
  align-items: flex-start;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
  word-break: keep-all;
}
.advice .chat-icon {
  width: 13px;
  height: 13px;
  margin-top: 2px;
}
.draft-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--fg);
  font-size: 11px;
  text-align: left;
}
.draft-chip:hover {
  border-color: var(--muted);
}
.draft-label {
  flex: none;
  color: var(--muted);
}
.draft-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 767px), (pointer: coarse) {
  .draft-chip {
    min-height: 44px;
  }
}
</style>
