<script setup lang="ts">
import type { SessionMenuItem } from './chat'
import { onMounted, ref } from 'vue'
import { useOverlay } from '../overlay/useOverlay'
import ChatIcon from './ChatIcon.vue'

// The avatar menu itself (OD chat guide 07). SessionMenuButton mounts it under its button
// while open. A surface panel with a 1px border and a shadow; the rows say the state, so
// nothing in it is yellow or coloured.

const props = defineProps<{
  /** `<dir>` or `<dir> · <branch>`, the first row */
  name: string
  items: SessionMenuItem[]
  /** The button that opened it: pressing it again toggles rather than counting as outside */
  trigger?: HTMLElement
  /** Opened from the keyboard: the first row takes focus; otherwise the button keeps it */
  fromKeys?: boolean
  /** Gallery: static rendering with no focus moves, keys, or outside clicks */
  preview?: boolean
}>()

const emit = defineEmits<{ close: [], choose: [item: SessionMenuItem] }>()

const panel = ref<HTMLElement>()
const rows = () => [...panel.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []]

// Escape and outside presses close it and focus returns to the button; no trap, Tab closes it
useOverlay({
  panel,
  close: () => emit('close'),
  initialFocus: () => props.fromKeys ? rows()[0] : props.trigger,
  closeOnOutside: () => [props.trigger],
  enabled: !props.preview,
})

// The feed scrolls: a menu opened near its bottom edge must not open out of sight
onMounted(() => {
  if (!props.preview)
    panel.value?.scrollIntoView({ block: 'nearest' })
})

function onKeydown(e: KeyboardEvent) {
  const list = rows()
  const i = list.indexOf(document.activeElement as HTMLButtonElement)
  const to = { ArrowDown: (i + 1) % list.length, ArrowUp: (i - 1 + list.length) % list.length, Home: 0, End: list.length - 1 }[e.key]
  if (to != null) {
    e.preventDefault()
    list[to]?.focus()
  }
  else if (e.key === 'Tab') {
    // Closing hands focus back to the button, the way Escape does
    e.preventDefault()
    emit('close')
  }
}

/** Arrow down from the button, while open, enters the menu */
function focusFirst() {
  rows()[0]?.focus()
}
defineExpose({ focusFirst })
</script>

<template>
  <div ref="panel" class="session-menu" role="menu" :aria-label="`${name} 세션 메뉴`" @keydown="onKeydown">
    <div class="menu-head" aria-hidden="true">
      {{ name }}
    </div>
    <button
      v-for="item in items" :key="item.action" type="button" role="menuitem" tabindex="-1"
      :disabled="!!item.why" @click="emit('choose', item)"
    >
      <ChatIcon :name="item.icon" />
      <span>{{ item.label }}</span>
      <span v-if="item.why" class="why">{{ item.why }}</span>
    </button>
  </div>
</template>

<style scoped>
.session-menu {
  position: absolute;
  top: calc(100% + 7px);
  left: -4px;
  z-index: var(--z-mention);
  width: min(224px, calc(100vw - 48px));
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 12px 32px var(--shade);
  text-align: left;
  /* Not the bold name of the message head it opens from */
  font-weight: 400;
}
.menu-head {
  padding: 6px 9px 5px;
  font: 400 10px var(--mono);
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 36px;
  padding: 0 9px;
  border-radius: 8px;
  font-size: 12px;
  text-align: left;
  color: var(--fg);
}
button .chat-icon {
  width: 15px;
  height: 15px;
  color: var(--muted);
}
button:hover:not(:disabled) {
  background: color-mix(in oklab, var(--fg) 8%, transparent);
  color: var(--fg);
}
button:hover:not(:disabled) .chat-icon {
  color: var(--fg);
}
/* Inside the row, so the panel edge never clips the ring */
button:focus-visible {
  outline: 2px solid var(--fg);
  outline-offset: -2px;
}
button:disabled {
  color: var(--muted);
  opacity: 1;
}
.why {
  margin-left: auto;
  font-size: 10px;
  color: var(--muted);
}
@media (pointer: coarse) {
  button {
    min-height: 44px;
  }
}
</style>
