// Settings from the settings sheet. They live in this browser only: saving
// connects to nothing and deletes no files (DESIGN.md Settings sheet).

import { ref } from 'vue'

export type Retention = '7' | '30' | 'forever'

export interface Settings {
  server: string
  /** Address to open on a phone; https only */
  phone: string
  retention: Retention
}

export type SettingsErrors = Partial<Record<'server' | 'phone', string>>

const STORAGE_KEY = 'gollabara-settings'

export function defaultSettings(): Settings {
  return { server: typeof location === 'undefined' ? '' : location.origin, phone: '', retention: '30' }
}

function isUrl(value: string, protocols: string[]) {
  try {
    return protocols.includes(new URL(value).protocol)
  }
  catch {
    return false
  }
}

/** Field errors, shown under each field; an empty phone address is allowed */
export function validateSettings(s: Settings): SettingsErrors {
  const errors: SettingsErrors = {}
  if (!isUrl(s.server.trim(), ['http:', 'https:']))
    errors.server = 'http:// 또는 https://로 시작하는 주소를 입력하세요'
  if (s.phone.trim() && !isUrl(s.phone.trim(), ['https:']))
    errors.phone = '폰용 주소는 https://로 시작해야 해요'
  return errors
}

function readStored(): Settings {
  const base = defaultSettings()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Settings> | null
    return saved ? { ...base, ...saved } : base
  }
  catch {
    return base
  }
}

const settings = ref<Settings>(readStored())

export function useSettings() {
  function save(next: Settings) {
    settings.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
    catch {}
  }
  return { settings, save }
}
