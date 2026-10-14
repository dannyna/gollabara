<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from './useToast'

// `text` pins a fixed message for gallery previews; otherwise the shared toast shows
const props = defineProps<{ text?: string }>()
const shared = useToast().text
const shown = computed(() => props.text ?? shared.value)
</script>

<template>
  <!-- Stays in the DOM so screen readers hear each new message; it never takes focus -->
  <div class="toast" role="status" :hidden="!shown">
    {{ shown }}
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  width: max-content;
  max-width: 90%;
  padding: 12px 20px;
  border-radius: 9px;
  background: var(--fg);
  color: var(--surface);
  box-shadow: 0 5px 25px var(--shade);
  font-size: 12px;
  text-align: center;
}
.toast[hidden] {
  display: none;
}

@media (max-width: 767px) {
  .toast {
    bottom: calc(25px + env(safe-area-inset-bottom));
  }
}
</style>
