// Settings from the settings sheet. Most live in this browser only: saving
// connects to nothing and deletes no files (DESIGN.md Settings sheet). The triage
// engine is the exception: the server runs it, so it is stored there.

import type { ServerSettings, TriageEngine } from '../../src/shared/types'
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

/** Changes a server-side setting; throws Error with the message to show */
export async function putServerSettings(next: ServerSettings, fetcher: typeof fetch = fetch): Promise<ServerSettings> {
  let res: Response
  try {
    res = await fetcher('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) })
  }
  catch {
    throw new Error('서버에 연결하지 못했어요')
  }
  if (res.status === 403)
    throw new Error('이 Mac이나 tailnet에서만 바꿀 수 있어요')
  if (res.status === 409)
    throw new Error(`${next.triage} CLI를 이 Mac에서 찾지 못했어요`)
  if (!res.ok)
    throw new Error('설정을 바꾸지 못했어요')
  return await res.json() as ServerSettings
}

export const ENGINE_LABEL: Record<TriageEngine, string> = { off: '끄기', claude: 'Claude', codex: 'Codex' }
