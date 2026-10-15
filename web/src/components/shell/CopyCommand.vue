<script setup lang="ts">
// A terminal command in mono with a copy button, for the first-run guide
import { ref } from 'vue'

defineProps<{ command: string }>()

const copied = ref(false)
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => copied.value = false, 1500)
  }
  catch {}
}
</script>

<template>
  <div class="code-copy">
    <code>{{ command }}</code>
    <button class="icon-button" type="button" :aria-label="copied ? '복사했어요' : `${command} 복사`" @click="copy(command)">
      <svg v-if="copied" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></svg>
    </button>
  </div>
</template>

<style scoped>
.code-copy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 4px 5px 4px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  text-align: left;
}
code {
  flex: 1;
  min-width: 0;
  font: 11px var(--mono);
  color: var(--fg);
  overflow-wrap: anywhere;
  word-break: break-all;
}
.icon-button {
  width: 44px;
  height: 44px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--fg);
}
.icon-button svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
