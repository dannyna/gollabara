<script setup lang="ts">
import type { Tone } from '../../../../src/shared/types'
import ChatIcon from './ChatIcon.vue'

// One recap line in a session message. Every state shares one box, so a late verdict only
// changes colour and the text never moves. The icon sits in the avatar column; the state
// colour is on the icon, the 1px border and a faint fill, never on the text.
withDefaults(defineProps<{
  text: string
  tone?: Tone
  /** The session's latest stated line; earlier ones keep only the icon */
  filled?: boolean
  /** Judged hidden after it was shown: dimmed in place */
  weak?: boolean
}>(), { tone: 'default' })

const LABEL: Record<Exclude<Tone, 'default'>, string> = { success: '성공', warning: '주의', danger: '위험' }
</script>

<template>
  <p class="recap-line" :class="[tone !== 'default' && tone, { filled: filled && tone !== 'default', weak }]">
    <template v-if="tone !== 'default'">
      <span class="tone-icon" :title="LABEL[tone]"><ChatIcon :name="tone" /></span><span class="sr">{{ LABEL[tone] }}: </span>
    </template>{{ text }}
  </p>
</template>

<style scoped>
.recap-line {
  --tone: var(--muted);
  position: relative;
  margin: 0 0 0 calc(-1 * var(--indent, 31px));
  padding: 5px 10px 5px var(--indent, 31px);
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--fg);
  font-size: 12px;
  line-height: 1.8;
}
.recap-line + .recap-line {
  margin-top: 4px;
}
.success {
  --tone: var(--ok);
}
.warning {
  --tone: var(--warn);
}
.danger {
  --tone: var(--risk);
}
.filled {
  background: color-mix(in oklab, var(--tone) 8%, transparent);
  border-color: color-mix(in oklab, var(--tone) 35%, transparent);
}
.weak {
  color: var(--muted);
  font-size: 11px;
}
.tone-icon {
  position: absolute;
  left: 3px;
  top: 7px;
  width: 23px;
  height: 15px;
  display: grid;
  place-items: center;
  color: var(--tone);
}
.recap-line .tone-icon .chat-icon {
  width: 15px;
  height: 15px;
  stroke-width: 1.7;
}
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
