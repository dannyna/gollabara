// Captures the reader split off with 「따로 보기」, and which cell shows each capture.
// Both are module-level so the stream, the viewer, and chat thumbnails share them.
// The split list lives in this browser only, keyed by capture (artifactKey).

import { ref } from 'vue'

const STORAGE_KEY = 'gollabara-split'

function readStored(): Set<string> {
  try {
    const keys = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(keys) ? keys.filter(k => typeof k === 'string') : [])
  }
  catch {
    return new Set()
  }
}

const split = ref<ReadonlySet<string>>(readStored())
/** Capture key → key of the cell that shows it (App fills it from toArtifacts) */
const cellOf = ref<ReadonlyMap<string, string>>(new Map())

export function useCaptures() {
  function splitOff(key: string) {
    if (split.value.has(key))
      return
    const next = new Set(split.value).add(key)
    split.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    }
    catch {}
  }
  return {
    split,
    splitOff,
    cellOf,
    /** The cell for a capture key, or the key itself when no cell holds it */
    cellKey: (key: string) => cellOf.value.get(key) ?? key,
  }
}
