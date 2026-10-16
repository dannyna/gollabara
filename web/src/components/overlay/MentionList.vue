<script setup lang="ts">
import { ref } from 'vue'

// Anchored list right above the composer box. No scrim and no focus trap; the
// composer owns it (opens on 「@」, closes on pick or Escape). With no match the
// composer closes it rather than drawing an empty list.

export interface MentionOption {
  id: string
  session: string
  branch?: string
  /** Parent path when another session has the same name (names.ts) */
  hint?: string
}

defineProps<{ options: MentionOption[] }>()
const emit = defineEmits<{ pick: [id: string], close: [] }>()

const list = ref<HTMLElement>()
const initial = (name: string) => name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toLowerCase()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')
    return
  e.preventDefault()
  const items = [...list.value!.querySelectorAll<HTMLElement>('[role="option"]')]
  const i = items.indexOf(document.activeElement as HTMLElement)
  items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
}

/** For the composer: ↓ from the textarea moves into the list */
function focusFirst() {
  list.value?.querySelector<HTMLElement>('[role="option"]')?.focus()
}
defineExpose({ focusFirst })
</script>

<template>
  <div v-if="options.length" ref="list" class="mention-list" role="listbox" aria-label="멘션할 세션" @keydown="onKeydown">
    <div class="mention-title">
      어느 세션에 말할까요?
    </div>
    <button
      v-for="o in options" :key="o.id" type="button" role="option" aria-selected="false"
      @click="emit('pick', o.id)"
    >
      <span class="avatar" aria-hidden="true">{{ initial(o.session) }}</span>
      <strong><span v-if="o.hint" class="name-hint">{{ o.hint }}</span>{{ o.session }}</strong>
      <span class="branch">{{ o.branch }}</span>
    </button>
  </div>
</template>

<style scoped>
.mention-list {
  position: absolute;
  bottom: calc(100% - 3px);
  left: 20px;
  right: 20px;
  z-index: var(--z-mention);
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 -8px 30px var(--shade);
}
.mention-title {
  padding: 3px 8px 6px;
  color: var(--muted);
  font-size: 10px;
}
button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 5px 8px;
  border-radius: 10px;
  font-size: 11px;
  text-align: left;
}
strong {
  font-weight: 600;
}
.name-hint {
  color: var(--muted);
  font-weight: 400;
}
.avatar {
  width: 23px;
  height: 23px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 8px;
  background: var(--bg);
  font: 600 11px var(--display);
}
.branch {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}

@media (max-width: 767px) {
  .mention-list {
    left: 12px;
    right: 12px;
  }
}
</style>
