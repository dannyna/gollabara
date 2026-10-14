<script setup lang="ts">
import type { Settings, SettingsErrors } from '../../settings'
import type { ThemePreference } from '../../theme'
import { nextTick, onMounted, ref, useId } from 'vue'
import { validateSettings } from '../../settings'
import OverlayIcon from './OverlayIcon.vue'
import { useOverlay } from './useOverlay'

const props = withDefaults(defineProps<{
  /** Saved values; the sheet edits a copy and drops it when closed without saving */
  settings: Settings
  theme: ThemePreference
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
}>()

const THEMES: { value: ThemePreference, label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
]

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

        <label :for="`${id}-retention`">보관 기간</label>
        <select :id="`${id}-retention`" v-model="form.retention" :aria-describedby="`${id}-retention-note`">
          <option value="7">
            7일
          </option>
          <option value="30">
            30일
          </option>
          <option value="forever">
            계속 보관
          </option>
        </select>
        <p :id="`${id}-retention-note`" class="description">
          화면 설정만 저장돼요. 실제 파일은 삭제하지 않아요.
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
input,
select {
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
  input,
  select {
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
