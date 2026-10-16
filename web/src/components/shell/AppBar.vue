<script setup lang="ts">
import type { ConnectionStatus } from '../banner/notices'
import { computed, ref } from 'vue'
import ConnectionChip from '../banner/ConnectionChip.vue'

const props = withDefaults(defineProps<{
  /** Connection chip: 「다시 연결 중」, or 「다시 연결됐어요」 for 3 s after it is back */
  connection?: ConnectionStatus
  /** Shorthand for `connection="offline"` */
  offline?: boolean
  /** 「전체 세션」 or the selected session's name */
  scopeLabel?: string
  /** Parent path before the selected session's name when another session shares it (names.ts) */
  scopeHint?: string
  /** Hidden on the first-connection setup guide */
  showSessionButton?: boolean
  sessionsOpen?: boolean
}>(), { scopeLabel: '전체 세션', showSessionButton: true })

defineEmits<{ sessions: [], theme: [], settings: [] }>()

const status = computed<ConnectionStatus>(() => props.connection ?? (props.offline ? 'offline' : 'online'))

// The session menu opens from the `sessions` slot, anchored under this button
const sessionButton = ref<HTMLButtonElement>()
defineExpose({ sessionButton })
</script>

<template>
  <header class="app-bar">
    <div class="identity">
      <div class="brand">
        <svg class="symbol" viewBox="0 0 512 512" aria-hidden="true"><path d="M198 120h-78v272h78m116-272h78v272h-78" fill="none" stroke="currentColor" stroke-width="40" /><circle cx="256" cy="256" r="42" fill="currentColor" /></svg>
        <span class="wordmark">gollabara</span>
      </div>
      <ConnectionChip :status="status" />
    </div>
    <nav class="dock" aria-label="스트림 도구">
      <div v-if="showSessionButton" class="session-anchor">
        <button
          ref="sessionButton" class="session-button" type="button"
          aria-haspopup="dialog" :aria-expanded="sessionsOpen" @click="$emit('sessions')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="13" height="13" rx="3" /><path d="M8 20h10a3 3 0 0 0 3-3V8" /></svg>
          <span class="session-text"><span v-if="scopeHint" class="name-hint">{{ scopeHint }}</span>{{ scopeLabel }}</span>
          <span class="chevron" aria-hidden="true">⌄</span>
        </button>
        <slot name="sessions" />
      </div>
      <button class="icon-button" type="button" aria-label="테마 전환" @click="$emit('theme')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z" /></svg>
      </button>
      <button class="icon-button" type="button" aria-label="설정" @click="$emit('settings')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></svg>
      </button>
    </nav>
  </header>
</template>

<style scoped>
.app-bar {
  height: 92px;
  flex: none;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--bg);
}
.identity {
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.symbol {
  display: block;
  width: 30px;
  height: 30px;
  padding: 3px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--on-accent);
}
.wordmark {
  font: 500 25px/1 var(--display);
  letter-spacing: -1.3px;
}

.dock {
  margin-left: auto;
  height: 54px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 3px;
  flex: none;
  max-width: 100%;
  border-radius: 17px;
  background: var(--surface);
}
.dock svg {
  display: block;
  width: 18px;
  height: 18px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.session-anchor {
  position: relative;
  display: flex;
  min-width: 0;
  margin-right: 3px;
}
.session-button {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 280px;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  background: var(--bg);
  font-size: 12px;
  white-space: nowrap;
}
.session-button:hover:not(:disabled),
.session-button[aria-expanded='true'] {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--muted);
}
.session-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chevron,
.name-hint {
  color: var(--muted);
}
.icon-button {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 11px;
}
.icon-button:hover:not(:disabled) {
  background: var(--bg);
}

@media (min-width: 768px) and (max-width: 1279px) {
  .app-bar {
    height: 88px;
    padding: 0 8px;
  }
}

/* Two rows: identity over a full-width dock */
@media (max-width: 767px) {
  .app-bar {
    height: 120px;
    padding: 0 12px 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 56px 54px;
    gap: 0;
  }
  .identity {
    gap: 12px;
    justify-content: space-between;
  }
  .symbol {
    width: 28px;
    height: 28px;
  }
  .wordmark {
    font-size: 24px;
    letter-spacing: -1.2px;
  }
  .dock {
    width: 100%;
    margin: 0;
    gap: 4px;
    border-radius: 16px;
  }
  /* The session menu spans the dock here, not just the trigger */
  .dock {
    position: relative;
  }
  .session-anchor {
    position: static;
    flex: 1;
    margin: 0;
  }
  .session-button {
    flex: 1;
    max-width: none;
    justify-content: flex-start;
  }
  .chevron {
    margin-left: auto;
  }
}
</style>
