// Settings from the settings sheet. The server stores all of them (#79), so the phone and the desktop
// agree; only the server address (and the theme, theme.ts) stays in this browser. Values from before
// that move up once: the first device to connect seeds the server, and its local copy is dropped.

import type { Retention, ServerSettings, SettingsPatch, TriageEngine } from '../../src/shared/types'
import { ref } from 'vue'

export type { Retention }

/** The sheet's form: the server address from this browser, the rest from the server */
export interface Settings {
  server: string
  /** Address to open on a phone; https only */
  phone: string
  retention: Retention
}

export type SettingsErrors = Partial<Record<'server' | 'phone', string>>

const STORAGE_KEY = 'gollabara-settings'

export function defaultSettings(): Settings {
  return { server: typeof location === 'undefined' ? '' : location.origin, phone: '', retention: 'forever' }
}

/** The sheet's values: an unset retention reads as 「계속 보관」, which is what the server does with it */
export function sheetSettings(server: string, stored: ServerSettings): Settings {
  return { server, phone: stored.phone ?? '', retention: stored.retention ?? 'forever' }
}

const DAYS: Record<Retention, number> = { 7: 7, 30: 30, forever: Infinity }

/** A shorter window deletes on save, so the sheet asks first */
export function shortensRetention(from: Retention, to: Retention): boolean {
  return DAYS[to] < DAYS[from]
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

function readStored(): Partial<Settings> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Settings> | null
    return saved && typeof saved === 'object' ? saved : {}
  }
  catch {
    return {}
  }
}

const server = ref<string>(readStored().server || defaultSettings().server)

export function useSettings() {
  function saveServer(next: string) {
    server.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ server: next }))
    }
    catch {}
  }
  return { server, saveServer }
}

/** What this browser kept from before the server stored settings, as a seed; null when nothing is left */
export function legacySettings(stored: Partial<Settings>): SettingsPatch | null {
  const patch: SettingsPatch = {}
  if (stored.retention === '7' || stored.retention === '30' || stored.retention === 'forever')
    patch.retention = stored.retention
  if (typeof stored.phone === 'string')
    patch.phone = stored.phone
  return Object.keys(patch).length ? { ...patch, seed: true } : null
}

/**
 * Moves this browser's phone address and retention to the server, once. The server writes only keys it
 * has no value for, so a stale device never overwrites another's choice. Kept locally if the server refuses.
 */
export async function migrateLocalSettings(fetcher: typeof fetch = fetch): Promise<void> {
  const stored = readStored()
  const seed = legacySettings(stored)
  if (!seed)
    return
  try {
    await putServerSettings(seed, fetcher)
  }
  catch {
    return
  }
  try {
    if (stored.server)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ server: stored.server }))
    else
      localStorage.removeItem(STORAGE_KEY)
  }
  catch {}
}

/** Changes a server-side setting; throws Error with the message to show */
export async function putServerSettings(next: SettingsPatch, fetcher: typeof fetch = fetch): Promise<ServerSettings> {
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
