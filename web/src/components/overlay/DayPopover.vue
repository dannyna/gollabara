<script setup lang="ts">
import type { HistoryDay } from '../../../../src/shared/types'
import { ref } from 'vue'
import { DAY_MS } from '../../history'
import { dayLabel } from '../chat/chat'
import OverlayIcon from './OverlayIcon.vue'
import { useOverlay } from './useOverlay'

// The day jump (#77): days that hold messages, newest first. Place it inside a
// `position: relative` wrapper around its trigger: it opens 8px below and aligns to the
// trigger's right edge. ≤767px it docks to the bottom edge over a scrim, like the session menu.

const props = defineProps<{
  /** null while the list is on its way */
  days: HistoryDay[] | null
  /** The list could not be loaded */
  error?: boolean
  /** Only the session in view is listed */
  scoped?: boolean
  /** The trigger: pressing it toggles the popover rather than counting as outside */
  anchor?: () => Element | null | undefined
  /** Gallery: static rendering with no focus moves, keys, or outside clicks */
  preview?: boolean
  /** Gallery: the wall clock the labels count back from */
  now?: number
}>()

const emit = defineEmits<{ close: [], pick: [start: number] }>()

const panel = ref<HTMLElement>()
const closeButton = ref<HTMLButtonElement>()

useOverlay({
  panel,
  close: () => emit('close'),
  trap: true,
  initialFocus: () => closeButton.value,
  closeOnOutside: () => [props.anchor?.()],
  enabled: !props.preview,
})

// The server's midnight is in this view's offset today; noon stays on the same day across a DST change
const label = (d: HistoryDay) => dayLabel(d.start + DAY_MS / 2, props.now)
</script>

<template>
  <div class="layer">
    <div class="scrim" aria-hidden="true" />
    <section ref="panel" class="popover" role="dialog" aria-label="날짜로 이동">
      <div class="popover-head">
        <h2>날짜로 이동</h2>
        <button ref="closeButton" class="icon-button" type="button" aria-label="날짜 목록 닫기" @click="emit('close')">
          <OverlayIcon name="close" />
        </button>
      </div>
      <p class="hint">
        {{ scoped ? '이 세션의 기록이 남아 있는 날만 보여요.' : '기록이 남아 있는 날만 보여요.' }}
      </p>
      <p v-if="error" class="state">
        날짜를 불러오지 못했어요
      </p>
      <p v-else-if="!days" class="state">
        불러오는 중
      </p>
      <p v-else-if="!days.length" class="state">
        아직 기록이 없어요
      </p>
      <ul v-else class="days">
        <li v-for="d in days" :key="d.start">
          <button type="button" class="day" @click="emit('pick', d.start)">
            <span>{{ label(d) }}</span>
            <span class="count"><span class="mono">{{ d.count }}</span>개</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.scrim {
  display: none;
}
.popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: var(--z-popover);
  width: 280px;
  max-width: calc(100vw - 24px);
  max-height: min(480px, calc(100dvh - 160px));
  display: flex;
  flex-direction: column;
  padding: 16px 16px 10px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 12px 45px var(--shade);
  color: var(--fg);
  text-align: left;
  white-space: normal;
}
.popover-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.popover-head h2 {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.4px;
}
.popover-head .icon-button {
  margin-right: -8px;
}
.hint {
  color: var(--muted);
  font-size: 11px;
}
.state {
  padding: 18px 10px 12px;
  color: var(--muted);
  font-size: 11px;
}
.days {
  min-height: 0;
  margin: 10px -6px 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.day {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 40px;
  padding: 0 10px;
  border-radius: 10px;
  color: var(--fg);
  font-size: 12px;
  text-align: left;
}
.day:hover {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.day .count {
  flex: none;
  color: var(--muted);
  font-size: 10px;
}
.day .mono {
  margin-right: 1px;
  font-size: 11px;
}

@media (pointer: coarse) {
  .day {
    min-height: 44px;
  }
}
@media (max-width: 767px) {
  /* Bottom sheet, as the session menu: it covers most of the screen, so a scrim goes under it */
  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    background: var(--scrim);
  }
  .popover {
    position: fixed;
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: none;
    max-height: 70%;
    padding: 14px 14px calc(14px + env(safe-area-inset-bottom));
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
  }
}
</style>
