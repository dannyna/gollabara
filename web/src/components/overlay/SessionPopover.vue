<script setup lang="ts">
import type { SessionState } from '../../../../src/shared/types'
import type { SessionRow } from '../../sessions'
import { computed, ref } from 'vue'
import { HARNESS_LABEL } from '../../firstrun'
import { activityLabel, HARNESS_MARK, listedSessions } from '../../sessions'
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
  /** Gallery: the name filter starts with this text */
  query?: string
  /** Gallery: the time 「n분 전」 counts from; the menu is mounted per opening, so Date.now() is fresh enough */
  now?: number
}>(), { mobile: 'bottom', query: '' })

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

// Only live sessions until the user searches (#112); a search also finds ended and message-only
// ones, so their history can still be scoped. 「전체 세션」 stays under the field.
const filter = ref(props.query)
const searching = computed(() => !!filter.value.trim())
const shown = computed(() => listedSessions(props.sessions, filter.value))
const now = props.now ?? Date.now()

const STATE_WORD: Record<SessionState, string> = { working: '작업 중', waiting: '기다리는 중', idle: '쉬는 중' }

const fullName = (s: SessionRow) => `${s.hint ?? ''}${s.session}${s.branch ? ` · ${s.branch}` : ''}`
/** A message-only row has no harness: the first letter of its name instead */
const mark = (s: SessionRow) => s.harness ? HARNESS_MARK[s.harness] : (s.session.match(/[\p{L}\p{N}]/u)?.[0] ?? '·').toUpperCase()
function stateWord(s: SessionRow): string {
  return [s.muted && '음소거', s.ended ? '끝남' : s.state && STATE_WORD[s.state]].filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="layer" :class="{ 'anchored-on-mobile': mobile === 'anchored' }">
    <div class="scrim" aria-hidden="true" />
    <section ref="panel" class="popover" role="dialog" aria-label="세션 선택과 관리">
      <div class="grip" aria-hidden="true" />
      <div class="popover-head">
        <h2>표시할 세션</h2>
        <button ref="closeButton" class="icon-button" type="button" aria-label="세션 목록 닫기" @click="emit('close')">
          <OverlayIcon name="close" />
        </button>
      </div>
      <p class="hint">
        볼 세션을 고르거나, 음소거해 숨길 수 있어요.
      </p>

      <input
        v-if="sessions.length" v-model="filter" class="filter" type="search" placeholder="세션 검색 · 끝난 세션도 찾아요"
        aria-label="세션 검색 · 끝난 세션도 찾아요" autocomplete="off" spellcheck="false"
      >

      <button
        class="scope-all" :class="{ 'is-current': scope == null }" type="button"
        :aria-pressed="scope == null" @click="emit('select', null)"
      >
        <strong>전체 세션</strong><small>음소거한 세션은 숨겨요</small>
      </button>

      <p v-if="sessions.length && !shown.length" class="no-match">
        {{ searching ? '이름이 맞는 세션이 없어요' : '실행 중인 세션이 없어요' }}
      </p>

      <div
        v-for="s in shown" :key="s.id" class="session-row"
        :class="{ 'is-current': scope === s.id, 'muted': s.muted, 'ended': s.ended }"
      >
        <!-- A muted session stays listed so it can be shown again, but it cannot be picked -->
        <button
          class="session-pick" type="button" :disabled="s.muted" :aria-pressed="scope === s.id"
          @click="emit('select', s.id)"
        >
          <span class="harness" aria-hidden="true">{{ mark(s) }}</span>
          <span class="identity">
            <span class="name"><span v-if="s.hint" class="name-hint">{{ s.hint }}</span>{{ s.session }}<template v-if="s.branch"> · {{ s.branch }}</template></span>
            <span class="meta">
              <span v-if="stateWord(s)" class="state" :class="s.ended ? undefined : s.state">
                <i class="state-mark" aria-hidden="true" />{{ stateWord(s) }}
              </span>
              <span v-if="s.harness">{{ HARNESS_LABEL[s.harness] }}</span>
              <span aria-hidden="true">·</span>
              <time>{{ activityLabel(s.lastSeenAt, now) }}</time>
            </span>
          </span>
        </button>
        <!-- Mute, inverted: off hides the session from 「전체 세션」 -->
        <button
          class="show-switch" type="button" role="switch" :aria-checked="!s.muted" :aria-label="`${fullName(s)} 표시`"
          @click="emit('mute', s.id)"
        >
          <span class="track" aria-hidden="true"><span class="knob" /></span>
          <span aria-hidden="true">{{ s.muted ? '숨김' : '표시' }}</span>
        </button>
      </div>

      <p v-if="sessions.length" class="foot">
        표시 스위치를 끄면 전체 세션에서 숨겨요.
      </p>
    </section>
  </div>
</template>

<style scoped>
.scrim,
.grip {
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
  padding: 14px;
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
  padding-left: 4px;
}
.popover-head h2 {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.4px;
}
.popover-head .icon-button {
  margin-right: -6px;
}
.hint {
  margin: 0 4px 12px;
  color: var(--muted);
  font-size: 11px;
}
/* Pressed into the surface like the composer box, so it reads as a field */
.filter {
  display: block;
  width: 100%;
  height: 40px;
  margin-bottom: 8px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: var(--bg);
  box-shadow: inset 0 1px 4px oklch(0 0 0 / 0.13);
  color: var(--fg);
  font-size: 12px;
}
.filter::placeholder {
  color: var(--muted);
}
@media (pointer: coarse) {
  .filter {
    height: 44px;
    /* 16px keeps iOS from zooming in on focus */
    font-size: 16px;
  }
}
.no-match {
  padding: 14px 10px 4px;
  color: var(--muted);
  font-size: 11px;
}

.scope-all,
.session-pick {
  width: 100%;
  border-radius: 9px;
  text-align: left;
}
.scope-all {
  display: block;
  margin-bottom: 3px;
  padding: 7px 10px;
}
.scope-all strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
}
.scope-all small {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.session-row {
  display: flex;
  align-items: center;
  min-width: 0;
  border-radius: 9px;
}
.session-row + .session-row {
  margin-top: 3px;
}
.session-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  min-height: 64px;
  padding: 9px 7px;
}
/* Hover is a half step toward --bg, so it never reads as the current scope */
.scope-all:hover:not(:disabled, .is-current),
.session-row:not(.is-current):has(.session-pick:hover:not(:disabled)) {
  background: color-mix(in oklch, var(--surface) 55%, var(--bg));
}
.session-pick:hover:not(:disabled) {
  background: none;
}
/* The current scope: a --bg fill only, with no check, border, or yellow */
.scope-all.is-current,
.session-row.is-current {
  background: var(--bg);
}
.scope-all:focus-visible,
.session-pick:focus-visible,
.show-switch:focus-visible {
  outline-offset: -2px;
}
/* Muted rows read as such through their colour, not the disabled fade */
.session-pick:disabled {
  opacity: 1;
}

.harness {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  flex: none;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg);
  color: var(--fg);
  font: 500 10px var(--mono);
}
.muted .harness,
.ended .harness {
  color: var(--muted);
}
.identity {
  min-width: 0;
  flex: 1;
}
.name {
  display: block;
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
/* The parent path that tells two sessions with one name apart */
.name-hint {
  color: var(--muted);
  font-weight: 400;
}
/* An ended session (found by a search) stays selectable; its name fades to muted, as does a muted one */
.muted .name,
.ended .name {
  color: var(--muted);
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}
.meta time {
  font-size: 9px;
  white-space: nowrap;
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
/* 「쉬는 중」 and 「끝남」 hollow, 「작업 중」 a filled dot, 「기다리는 중」 a filled square */
.state-mark {
  width: 6px;
  height: 6px;
  border: 1px solid var(--muted);
  border-radius: 50%;
}
.state.working .state-mark,
.state.waiting .state-mark {
  border-color: var(--fg);
  background: var(--fg);
}
.state.waiting .state-mark {
  border-radius: 1px;
}

.show-switch {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 3px;
  flex: none;
  min-width: 48px;
  min-height: 44px;
  padding: 4px;
  border-radius: 8px;
  color: var(--muted);
  font-size: 9px;
}
.show-switch:hover:not(:disabled) {
  background: none;
  color: var(--fg);
}
.track {
  display: block;
  width: 25px;
  height: 14px;
  padding: 2px;
  border-radius: 10px;
  background: var(--muted);
}
.knob {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--surface);
  transform: translateX(11px);
}
.show-switch[aria-checked='false'] .track {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.show-switch[aria-checked='false'] .knob {
  background: var(--muted);
  transform: none;
}
.foot {
  padding: 9px 5px 0;
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 767px) {
  .popover {
    width: 366px;
  }
  /* Bottom sheet: it covers most of the screen, so only here a scrim goes under it */
  .layer:not(.anchored-on-mobile) .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    background: var(--scrim);
  }
  .layer:not(.anchored-on-mobile) .grip {
    display: block;
    width: 32px;
    height: 3px;
    margin: 0 auto 3px;
    border-radius: 3px;
    background: var(--border);
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
    padding: 10px 14px calc(18px + env(safe-area-inset-bottom));
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
  }
}
</style>
