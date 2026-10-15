// The stream cell the reader pinned, so new arrivals stop pulling the rail away from it.
// Lives in this browser only, keyed by the cell's artifact key, which a new capture of
// the same screen keeps. The rules (toggle, active, hold) are in stream/follow.ts.

import { ref } from 'vue'

const STORAGE_KEY = 'gollabara-pin'

function readStored(): string | null {
  try {
    const key = localStorage.getItem(STORAGE_KEY)
    return key || null
  }
  catch {
    return null
  }
}

const pinned = ref<string | null>(readStored())

export function usePin() {
  function setPin(key: string | null) {
    pinned.value = key
    try {
      if (key)
        localStorage.setItem(STORAGE_KEY, key)
      else
        localStorage.removeItem(STORAGE_KEY)
    }
    catch {}
  }
  return { pinned, setPin }
}
