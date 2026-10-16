<script setup lang="ts">
import type { AnswerSetting, TriageEngine } from '../../../../src/shared/types'
import type { PushState } from '../../push'
import type { Settings, SettingsErrors } from '../../settings'
import type { ThemePreference } from '../../theme'
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { ENGINE_LABEL, validateSettings } from '../../settings'
import OverlayIcon from './OverlayIcon.vue'
import { useOverlay } from './useOverlay'

const props = withDefaults(defineProps<{
  /** Saved values; the sheet edits a copy and drops it when closed without saving */
  settings: Settings
  theme: ThemePreference
  /** 대화 정리: the server's triage engine */
  engine?: TriageEngine
  /** 앱에서 답하기: whether the server holds Claude Code's questions for the app */
  answer?: AnswerSetting
  /** 알림 받기: this device's push subscription */
  push?: PushState
  /** Turning push on or off is in progress */
  pushBusy?: boolean
  /** Gallery: start from these values instead of the saved ones */
  draft?: Partial<Settings>
  /** Gallery: show field errors right away */
  validate?: boolean
  /** Gallery: static rendering with no focus moves, keys, or scroll lock */
  preview?: boolean
  /** ≤767px: 'bottom' rises from the bottom edge, 'side' keeps the full-width right sheet */
  mobile?: 'bottom' | 'side'
}>(), { mobile: 'bottom' })

const emit = defineEmits<{
  'close': []
  'save': [settings: Settings]
  // Theme applies at once, like the dock button; it is not part of the saved draft
  'update:theme': [theme: ThemePreference]
  // Applies at once too: it is stored on the server, not in this browser
  'update:engine': [engine: TriageEngine]
  // Applies at once too, on the server
  'update:answer': [answer: AnswerSetting]
  // Applies at once: it subscribes this device with its browser
  'update:push': [on: boolean]
}>()

const THEMES: { value: ThemePreference, label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
]

const ENGINES = (['off', 'claude', 'codex'] as const).map(value => ({ value, label: ENGINE_LABEL[value] }))

// The ping goes through the browser vendor's push service, so the note says what leaves: a signal, no content
const PUSH_ABOUT = '세션이 질문하거나 피드백에 답하면 이 기기에 알려요. 이 Mac 밖으로는 내용 없는 신호만 나가요.'
const PUSH_NOTE: Record<PushState, string> = {
  'off': PUSH_ABOUT,
  'on': PUSH_ABOUT,
  'denied': '이 브라우저에서 알림을 막아 두었어요. 브라우저 설정에서 허용하면 켤 수 있어요.',
  'unsupported': '이 브라우저에서는 알림을 받을 수 없어요.',
  'ios-browser': 'iPhone에서는 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요.',
}
const pushReady = computed(() => props.push === 'on' || props.push === 'off')

const id = useId()
const panel = ref<HTMLElement>()
const closeButton = ref<HTMLButtonElement>()
const fields = { server: ref<HTMLInputElement>(), phone: ref<HTMLInputElement>() }
const serverField = fields.server
const phoneField = fields.phone
const form = ref<Settings>({ ...props.settings, ...props.draft })
const errors = ref<SettingsErrors>({})

useOverlay({
  panel,
  close: () => emit('close'),
  trap: true,
  lockScroll: true,
  initialFocus: () => closeButton.value,
  enabled: !props.preview,
})

onMounted(() => {
  if (props.validate)
    errors.value = validateSettings(form.value)
})

async function save() {
  const next = { ...form.value, server: form.value.server.trim(), phone: form.value.phone.trim() }
  errors.value = validateSettings(next)
  const first = (['server', 'phone'] as const).find(k => errors.value[k])
  if (first) {
    // Errors sit under their fields; focus goes to the first one
    await nextTick()
    fields[first].value?.focus()
    return
  }
  emit('save', next)
}
</script>

<template>
  <div class="overlay" :class="{ 'side-on-mobile': mobile === 'side' }" @click.self="emit('close')">
    <form
      ref="panel" class="sheet" role="dialog" aria-modal="true" :aria-labelledby="`${id}-title`"
      novalidate @submit.prevent="save"
    >
      <div class="sheet-head">
        <h2 :id="`${id}-title`">
          설정
        </h2>
        <button ref="closeButton" class="icon-button" type="button" aria-label="설정 닫기" @click="emit('close')">
          <OverlayIcon name="close" />
        </button>
      </div>

      <div class="sheet-body">
        <label :for="`${id}-server`">서버 주소</label>
        <input
          :id="`${id}-server`" ref="serverField" v-model="form.server" type="url" autocomplete="off"
          :aria-invalid="!!errors.server" :aria-describedby="`${id}-server-note`"
        >
        <p v-if="errors.server" :id="`${id}-server-note`" class="field-error">
          <OverlayIcon name="alert" />{{ errors.server }}
        </p>
        <p v-else :id="`${id}-server-note`" class="description">
          이 브라우저에만 저장돼요. 지금 연결은 바꾸지 않아요.
        </p>

        <label :for="`${id}-phone`">폰용 주소</label>
        <input
          :id="`${id}-phone`" ref="phoneField" v-model="form.phone" type="url" autocomplete="off"
          placeholder="https://my-mac.ts.net" :aria-invalid="!!errors.phone" :aria-describedby="`${id}-phone-note`"
        >
        <p v-if="errors.phone" :id="`${id}-phone-note`" class="field-error">
          <OverlayIcon name="alert" />{{ errors.phone }}
        </p>
        <p v-else :id="`${id}-phone-note`" class="description">
          내 Mac의 Tailscale HTTPS 주소를 입력하세요.
        </p>

        <p :id="`${id}-theme`" class="label">
          테마
        </p>
        <div class="theme-options" role="group" :aria-labelledby="`${id}-theme`">
          <button
            v-for="t in THEMES" :key="t.value" type="button" :aria-pressed="theme === t.value"
            @click="emit('update:theme', t.value)"
          >
            {{ t.label }}
          </button>
        </div>

        <p :id="`${id}-triage`" class="label">
          대화 정리
        </p>
        <div class="theme-options" role="group" :aria-labelledby="`${id}-triage`" :aria-describedby="`${id}-triage-note`">
          <button
            v-for="e in ENGINES" :key="e.value" type="button" :aria-pressed="(engine ?? 'off') === e.value"
            @click="emit('update:engine', e.value)"
          >
            {{ e.label }}
          </button>
        </div>
        <p :id="`${id}-triage-note`" class="description">
          이 Mac의 claude 또는 codex CLI가 새 세션 메시지를 읽고 볼 필요 없는 줄은 숨겨요. 메시지 글과 그 세션에 보낸 피드백 글은 그 CLI의 모델로 전송되고, 이미지는 보내지 않아요.
        </p>

        <div class="switch-row">
          <span :id="`${id}-answer`">앱에서 답하기</span>
          <button
            class="switch" type="button" role="switch" :aria-checked="answer === 'on'" :aria-labelledby="`${id}-answer`"
            :aria-describedby="`${id}-answer-note`" @click="emit('update:answer', answer === 'on' ? 'off' : 'on')"
          >
            <span class="track" aria-hidden="true"><span class="knob" /></span>
            <span aria-hidden="true">{{ answer === 'on' ? '켜짐' : '꺼짐' }}</span>
          </button>
        </div>
        <p :id="`${id}-answer-note`" class="description">
          세션이 물으면 60초 동안 여기서 답할 수 있어요. 그동안 터미널에는 질문이 보이지 않아요. Claude Code 세션만 돼요.
        </p>

        <p :id="`${id}-push`" class="label">
          알림 받기
        </p>
        <div class="theme-options" role="group" :aria-labelledby="`${id}-push`" :aria-describedby="`${id}-push-note`">
          <button
            v-for="on in [false, true]" :key="String(on)" type="button" :disabled="!pushReady || pushBusy"
            :aria-pressed="(push === 'on') === on" @click="emit('update:push', on)"
          >
            {{ on ? '켜기' : '끄기' }}
          </button>
        </div>
        <p :id="`${id}-push-note`" class="description">
          {{ PUSH_NOTE[push ?? 'off'] }}
        </p>

        <div class="brand">
          <div class="wordmark">
            gollabara
          </div>
          <p class="mono">
            산출물은 이 기기에만 저장돼요
          </p>
        </div>
      </div>

      <div class="sheet-foot">
        <button class="secondary save" type="submit">
          설정 저장
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet);
  display: flex;
  justify-content: flex-end;
  background: var(--scrim);
}
/* Head and foot stay put while the body scrolls between them */
.sheet {
  --px: 28px;
  width: min(430px, 100%);
  height: 100%;
  padding: 0 var(--px);
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--surface);
  box-shadow: -12px 0 50px var(--shade);
}
.sheet-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 calc(-1 * var(--px));
  padding: 20px var(--px) 14px;
  background: var(--surface);
  box-shadow: 0 1px 0 var(--border);
}
.sheet-head h2 {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.6px;
}
.sheet-head .icon-button {
  margin-right: -10px;
}
label,
.label {
  display: block;
  margin: 25px 0 9px;
  font-size: 12px;
}
input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg);
  color: var(--fg);
  font-size: 12px;
}
input::placeholder {
  color: var(--muted);
}
input[aria-invalid='true'] {
  border-color: var(--fg);
  box-shadow: inset 0 0 0 1px var(--fg);
}
.description {
  margin-top: 8px;
  color: var(--muted);
  font-size: 11px;
}
/* No red: fg text and an icon */
.field-error {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  margin-top: 8px;
  color: var(--fg);
  font-size: 11px;
  line-height: 1.6;
}
.field-error .icon {
  width: 14px;
  height: 14px;
  margin-top: 2px;
}
.theme-options {
  display: flex;
  gap: 7px;
}
.theme-options button {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 7px;
}
.theme-options button[aria-pressed='true'],
.theme-options button[aria-pressed='true']:hover {
  border-color: var(--fg);
  background: var(--fg);
  color: var(--surface);
}
/* One switch on the label's line, like the session menu's show switch */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 19px 0 0;
  font-size: 12px;
}
.switch {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  min-width: 44px;
  min-height: 44px;
  margin-right: -6px;
  padding: 0 6px;
  border-radius: 8px;
  color: var(--muted);
  font-size: 11px;
}
.switch:hover:not(:disabled) {
  background: none;
  color: var(--fg);
}
.track {
  display: block;
  width: 25px;
  height: 14px;
  padding: 2px;
  border-radius: 10px;
  background: var(--fg);
}
.knob {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--surface);
  transform: translateX(11px);
}
.switch[aria-checked='false'] .track {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.switch[aria-checked='false'] .knob {
  background: var(--muted);
  transform: none;
}
.brand {
  margin-top: 35px;
  padding: 22px 0;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
}
.brand .wordmark {
  font: 500 21px/1 var(--display);
  letter-spacing: -1px;
  color: var(--fg);
}
.brand .mono {
  display: block;
  margin-top: 12px;
}
.sheet-foot {
  position: sticky;
  bottom: 0;
  margin: 0 calc(-1 * var(--px));
  padding: 14px var(--px) 20px;
  background: var(--surface);
  box-shadow: 0 -1px 0 var(--border);
}
.save {
  width: 100%;
}

@media (max-width: 767px) {
  .sheet {
    --px: 20px;
  }
  /* 16px keeps iOS from zooming into the field */
  input {
    font-size: 16px;
  }
  .sheet-foot {
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }
  /* Rises from the bottom so the save button sits under the thumb */
  .overlay:not(.side-on-mobile) {
    align-items: flex-end;
  }
  .overlay:not(.side-on-mobile) .sheet {
    width: 100%;
    height: auto;
    max-height: 86%;
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -12px 50px var(--shade);
  }
}
</style>
