// Theme preference: 'dark' (default), 'light', or 'system' (follows prefers-color-scheme).
// index.html applies the stored value before paint; this module keeps it in sync afterwards.

import { ref } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

// Also read by the inline script in web/index.html
const STORAGE_KEY = 'gollabara-theme'

function isPreference(v: unknown): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark'
}

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isPreference(v) ? v : 'dark'
  }
  catch {
    return 'dark'
  }
}

export function applyTheme(pref: ThemePreference) {
  if (pref === 'system')
    delete document.documentElement.dataset.theme
  else
    document.documentElement.dataset.theme = pref
  // Browser chrome on phones; the hex values are --bg in each theme
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#181B1F' : '#F5F6F7')
}

const preference = ref<ThemePreference>(readStored())

export function useTheme() {
  function setTheme(pref: ThemePreference) {
    preference.value = pref
    applyTheme(pref)
    try {
      localStorage.setItem(STORAGE_KEY, pref)
    }
    catch {}
  }

  // The dock button flips between light and dark, resolving 'system' first
  function toggleTheme() {
    const dark = preference.value === 'dark'
      || (preference.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    setTheme(dark ? 'light' : 'dark')
  }

  return { preference, setTheme, toggleTheme }
}
