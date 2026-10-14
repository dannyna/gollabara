<script setup lang="ts">
import { ref, useId } from 'vue'
import { useOverlay } from './useOverlay'

// Asks before something that cannot be undone, and nothing else. Cancel takes
// the first focus so one Enter never deletes; Escape and the scrim also cancel.

const props = withDefaults(defineProps<{
  title: string
  /** The action, as the verb itself (e.g. 「줄이고 지우기」) */
  confirmLabel: string
  /**
   * Opened over the settings sheet: it reuses the sheet's scrim instead of laying
   * a second one, and the sheet stays open underneath
   */
  overSheet?: boolean
  /** Gallery: static rendering with no focus moves or keys */
  preview?: boolean
}>(), { overSheet: false })

const emit = defineEmits<{ cancel: [], confirm: [] }>()

const id = useId()
const panel = ref<HTMLElement>()
const cancelButton = ref<HTMLButtonElement>()

useOverlay({
  panel,
  close: () => emit('cancel'),
  trap: true,
  lockScroll: true,
  stacked: props.overSheet,
  initialFocus: () => cancelButton.value,
  enabled: !props.preview,
})
</script>

<template>
  <div class="overlay" :class="{ 'no-scrim': overSheet }" @click.self="emit('cancel')">
    <div
      ref="panel" class="confirm" role="alertdialog" aria-modal="true"
      :aria-labelledby="`${id}-title`" :aria-describedby="`${id}-body`"
    >
      <h2 :id="`${id}-title`">
        {{ title }}
      </h2>
      <p :id="`${id}-body`">
        <slot />
      </p>
      <div class="confirm-foot">
        <button ref="cancelButton" class="secondary" type="button" @click="emit('cancel')">
          취소
        </button>
        <!-- Filled with --fg: no red, no yellow -->
        <button class="fg-button" type="button" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  background: var(--scrim);
}
.overlay.no-scrim {
  background: none;
}
.confirm {
  width: min(400px, 100%);
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 12px 45px var(--shade);
}
h2 {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}
p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.75;
}
p :deep(b) {
  color: var(--fg);
  font-weight: 600;
}
.confirm-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 22px;
}

/* Docked to the bottom; the action on top, cancel nearest the thumb */
@media (max-width: 767px) {
  .overlay {
    align-items: flex-end;
    padding: 0;
  }
  .confirm {
    width: 100%;
    padding-bottom: calc(22px + env(safe-area-inset-bottom));
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
  }
  .confirm-foot {
    flex-direction: column-reverse;
  }
  .confirm-foot button {
    width: 100%;
  }
}
</style>
