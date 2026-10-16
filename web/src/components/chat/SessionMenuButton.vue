<script setup lang="ts">
import type { SessionMenuItem } from './chat'
import { computed, ref, useId } from 'vue'
import { sessionMenuItems } from './chat'
import ChatIcon from './ChatIcon.vue'
import SessionAvatar from './SessionAvatar.vue'
import SessionMenu from './SessionMenu.vue'
import SessionName from './SessionName.vue'

// Avatar and name as one button that opens the avatar menu (OD chat guide 07). It looks like
// the plain head until hovered or focused. The parent does the work, so each row does what
// the same action in the session menu does.

const props = defineProps<{
  /** `<dir>` or `<dir> · <branch>` */
  name: string
  /** Parent path that tells the session apart from another with the same name (names.ts) */
  hint?: string
  /** The view is scoped to this session */
  scoped?: boolean
  muted?: boolean
  /** The session ended: the avatar and name fade, and 「끝남」 follows the name */
  ended?: boolean
  /** A system line's 17px avatar: the button wraps the name in the line's text, and the menu centres under the line */
  small?: boolean
}>()

const emit = defineEmits<{
  /** 「이 세션만 보기」, or 「전체 세션 보기」 while scoped */
  scope: []
  mute: []
  /** 「이 세션 데이터 삭제」: the parent asks before anything is deleted */
  delete: []
}>()

const open = ref(false)
/** Opened with Enter or Space: the first row takes focus */
const fromKeys = ref(false)
const trigger = ref<HTMLButtonElement>()
const menu = ref<InstanceType<typeof SessionMenu>>()
const menuId = useId()
const items = computed(() => sessionMenuItems(props.scoped, props.muted))
// The menu's header and the screen reader say the hint too, or two such sessions sound alike
const label = computed(() => (props.hint ?? '') + props.name)

function toggle(e: MouseEvent) {
  if (open.value) {
    open.value = false
    return
  }
  // Safari does not focus a clicked button, and closing hands focus back to it
  trigger.value?.focus()
  // A click from Enter or Space has no pointer behind it
  fromKeys.value = e.detail === 0
  open.value = true
}

function close() {
  open.value = false
  // A press outside on plain text drops focus to the body after the menu handed it back;
  // a press on another control keeps it there
  requestAnimationFrame(() => {
    if (document.activeElement === document.body)
      trigger.value?.focus({ preventScroll: true })
  })
}

function choose(item: SessionMenuItem) {
  open.value = false
  if (item.action === 'scope')
    emit('scope')
  else if (item.action === 'mute')
    emit('mute')
  else
    emit('delete')
}

function onKeydown(e: KeyboardEvent) {
  if (open.value && e.key === 'ArrowDown') {
    e.preventDefault()
    menu.value?.focusFirst()
  }
}
</script>

<template>
  <span class="menu-anchor" :class="{ small }">
    <button
      ref="trigger" class="head-hit" type="button" aria-haspopup="menu" :aria-expanded="open"
      :aria-controls="open ? menuId : undefined" :aria-label="`${label}${ended ? ' · 끝남' : ''} 세션 메뉴 열기`"
      @click="toggle" @keydown="onKeydown"
    >
      <SessionAvatar :name="name" :small="small" :ended="ended" />
      <span v-if="small">{{ label }}</span>
      <strong v-else :class="{ ended }"><SessionName :name="name" :hint="hint" /></strong>
      <span v-if="ended && !small" class="ended-tag">끝남</span>
      <ChatIcon v-if="!small" class="caret" name="chev" />
    </button>
    <SessionMenu
      v-if="open" :id="menuId" ref="menu" :name="label" :ended="ended" :items="items" :trigger="trigger"
      :from-keys="fromKeys" @close="close" @choose="choose"
    />
  </span>
</template>

<style scoped>
/* The anchor's box is the head row; the button grows past it by negative margins */
.menu-anchor {
  position: relative;
  display: flex;
  min-width: 0;
}
.head-hit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 29px;
  margin: -3px 0 -3px -4px;
  padding: 0 6px 0 3px;
  border: 1px solid transparent;
  border-radius: 10px;
  text-align: left;
}
.head-hit strong {
  display: flex;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
}
/* Ended: the name takes the muted colour (not opacity), and a plain 「끝남」 says why */
.head-hit strong.ended {
  color: var(--muted);
}
.ended-tag {
  flex: none;
  font-size: 10px;
  font-weight: 400;
  color: var(--muted);
}
.caret {
  width: 12px;
  height: 12px;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.12s;
}
.head-hit:hover:not(:disabled),
.head-hit:focus-visible,
.head-hit[aria-expanded='true'] {
  background: color-mix(in oklab, var(--fg) 7%, transparent);
  color: var(--fg);
}
/* Open: the button keeps its surface and gains the border while the menu shows */
.head-hit[aria-expanded='true'] {
  border-color: var(--border);
}
.head-hit:hover .caret,
.head-hit:focus-visible .caret,
.head-hit[aria-expanded='true'] .caret {
  opacity: 1;
}
.head-hit:hover :deep(.session-avatar),
.head-hit:focus-visible :deep(.session-avatar),
.head-hit[aria-expanded='true'] :deep(.session-avatar) {
  box-shadow: inset 0 0 0 1px var(--muted);
}
.head-hit:focus-visible {
  outline-offset: 2px;
}

/* System line: the avatar and the name sit inline in the centred text */
.menu-anchor.small {
  position: static;
  display: inline-flex;
  vertical-align: middle;
  margin-right: 6px;
}
.small .head-hit {
  gap: 6px;
  min-height: 28px;
  margin: 0;
  border-radius: 9px;
  font-size: inherit;
  color: inherit;
}
.small :deep(.session-menu) {
  left: 50%;
  transform: translateX(-50%);
}

/* No hover on touch: the chevron always shows, and the button reaches 44 */
@media (pointer: coarse) {
  .head-hit {
    min-height: 44px;
    margin: -11px 0 -11px -4px;
  }
  .small .head-hit {
    margin: -8px 0;
  }
  .caret {
    opacity: 1;
  }
}
@media (max-width: 767px) {
  .head-hit strong {
    font-size: 10px;
  }
}
</style>
