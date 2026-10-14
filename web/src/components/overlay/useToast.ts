// One toast at a time: a new one replaces the text and restarts the 3 seconds.
// Hovering does not hold it. Only for the result of something the user just did.

import { ref } from 'vue'

const DURATION_MS = 3000

const text = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

export function useToast() {
  function toast(message: string) {
    text.value = message
    clearTimeout(timer)
    timer = setTimeout(() => text.value = '', DURATION_MS)
  }
  return { text, toast }
}
