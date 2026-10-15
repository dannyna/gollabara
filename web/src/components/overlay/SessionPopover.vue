<script setup lang="ts">
import type { SessionRow } from '../../sessions'
import { ref } from 'vue'
import { clock } from '../../artifacts'
import OverlayIcon from './OverlayIcon.vue'
import { useOverlay } from './useOverlay'

// The session menu. Place it inside a `position: relative` wrapper around its
// trigger: it opens 10px below and aligns to the trigger's right edge.

const props = withDefaults(defineProps<{
  sessions: SessionRow[]
  /** Session in view, or null for 「전체 세션」 */
  scope: string | null
  /** The trigger: pressing it toggles the menu rather than counting as outside */
  anchor?: () => Element | null | undefined
  /** Gallery: static rendering with no focus moves, keys, or outside clicks */
  preview?: boolean
  /** ≤767px: 'bottom' docks it to the bottom edge over a scrim, 'anchored' keeps it under the trigger */
  mobile?: 'bottom' | 'anchored'
}>(), { mobile: 'bottom' })

const emit = defineEmits<{ close: [], select: [id: string | null], mute: [id: string] }>()

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
</script>

<template>
  <div class="layer" :class="{ 'anchored-on-mobile': mobile === 'anchored' }">
    <div class="scrim" aria-hidden="true" />
    <section ref="panel" class="popover" role="dialog" aria-label="세션 선택과 관리">
      <div class="popover-head">
        <h2>표시할 세션</h2>
        <button ref="closeButton" class="icon-button" type="button" aria-label="세션 목록 닫기" @click="emit('close')">
          <OverlayIcon name="close" />
        </button>
      </div>
      <p class="hint">
        볼 세션을 고르거나, 음소거해 숨길 수 있어요.
      </p>

      <button
        class="scope-all" :class="{ 'is-current': scope == null }" type="button"
        :aria-pressed="scope == null" @click="emit('select', null)"
      >
        <span class="scope-check" aria-hidden="true">{{ scope == null ? '✓' : '' }}</span>
        <span><strong>전체 세션</strong><small>음소거한 세션은 숨겨요</small></span>
      </button>

      <div v-for="s in sessions" :key="s.id" class="session-row" :class="{ 'is-current': scope === s.id }">
        <!-- A muted session stays listed so it can be unmuted, but it cannot be picked -->
        <button
          class="session-pick" type="button" :disabled="s.muted" :aria-pressed="scope === s.id"
          @click="emit('select', s.id)"
        >
          <span class="scope-check" aria-hidden="true">{{ scope === s.id ? '✓' : '' }}</span>
          <span class="scope-name"><strong>{{ s.session }}</strong><small v-if="s.branch">{{ s.branch }}</small></span>
          <span v-if="s.muted" class="session-state">음소거</span>
        </button>
        <div class="session-ops">
          <button type="button" :aria-pressed="s.muted" @click="emit('mute', s.id)">
            {{ s.muted ? '음소거 해제' : '음소거' }}
          </button>
          <time>마지막 활동 {{ clock(s.lastSeenAt) }}</time>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scrim {
  display: none;
}
.popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: var(--z-popover);
  width: 390px;
  max-width: calc(100vw - 24px);
  max-height: max(160px, calc(100dvh - 120px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 12px 45px var(--shade);
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
.scope-all,
.session-pick {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border-radius: 10px;
  text-align: left;
}
.scope-all {
  min-height: 66px;
  margin-top: 14px;
  padding: 12px 10px;
}
.session-pick {
  min-height: 61px;
  padding: 7px 10px;
}
.scope-all:hover:not(:disabled),
.session-pick:hover:not(:disabled) {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
  color: var(--fg);
}
/* The current scope: a --bg fill and a check, never yellow */
.scope-all.is-current,
.session-row.is-current {
  background: var(--bg);
}
.scope-check {
  display: flex;
  justify-content: center;
  width: 18px;
  flex: none;
  font-size: 12px;
}
.scope-all strong,
.session-pick strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
}
.scope-all small,
.session-pick small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}
.scope-name {
  min-width: 0;
  flex: 1;
}
.scope-name strong,
.scope-name small {
  overflow-wrap: anywhere;
}
.session-state {
  flex: none;
  margin-left: 8px;
  color: var(--muted);
  font-size: 10px;
}
.session-row {
  margin-top: 7px;
  padding: 5px 0 11px;
  border-radius: 10px;
}
.session-ops {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0 10px 0 38px;
}
.session-ops button {
  min-height: 44px;
  padding: 0 10px;
  border-radius: 7px;
  background: var(--bg);
  font-size: 10px;
}
.session-row.is-current .session-ops button {
  background: var(--surface);
}
.session-ops button:hover:not(:disabled) {
  background: var(--bg);
  color: var(--fg);
  box-shadow: inset 0 0 0 1px var(--muted);
}
.session-ops time {
  margin-left: auto;
  color: var(--muted);
  font-size: 9px;
}

@media (max-width: 767px) {
  .popover {
    width: 366px;
    padding: 14px;
  }
  .session-ops {
    gap: 4px;
  }
  .session-ops time {
    font-size: 8px;
  }
  /* Bottom sheet: it covers most of the screen, so only here a scrim goes under it */
  .layer:not(.anchored-on-mobile) .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    background: var(--scrim);
  }
  .layer:not(.anchored-on-mobile) .popover {
    position: fixed;
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: none;
    max-height: 80%;
    padding: 14px 14px calc(18px + env(safe-area-inset-bottom));
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
  }
}
</style>
