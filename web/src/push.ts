// 「알림 받기」 (#64): this device's Web Push subscription. Off until the user turns it on here, and
// permission is asked only on that click. The browser's own subscription is the state, so it is per
// device without anything in localStorage. The pings carry no session text; web/sw.js shows fixed copy.

import { ref } from 'vue'

/**
 * - `unsupported`: no push in this browser, or no service worker (the dev server has none)
 * - `ios-browser`: iOS delivers push only to the app added to the home screen
 * - `denied`: the user blocked notifications for this site in the browser
 */
export type PushState = 'unsupported' | 'ios-browser' | 'denied' | 'off' | 'on'

export interface PushEnv {
  supported: boolean
  ios: boolean
  standalone: boolean
  permission: NotificationPermission
  subscribed: boolean
}

export function pushState(env: PushEnv): PushState {
  if (env.ios && !env.standalone)
    return 'ios-browser'
  if (!env.supported)
    return 'unsupported'
  if (env.permission === 'denied')
    return 'denied'
  return env.subscribed && env.permission === 'granted' ? 'on' : 'off'
}

function isIos(): boolean {
  // iPadOS reports itself as a Mac; touch tells them apart
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator) || typeof PushManager === 'undefined' || typeof Notification === 'undefined')
    return undefined
  // Not `ready`: it never settles where no worker is registered
  return await navigator.serviceWorker.getRegistration().catch(() => undefined)
}

const state = ref<PushState>('off')
const busy = ref(false)

async function refresh(): Promise<void> {
  const reg = await registration()
  const subscribed = !!(await reg?.pushManager.getSubscription().catch(() => null))
  state.value = pushState({
    supported: !!reg,
    ios: isIos(),
    standalone: isStandalone(),
    permission: typeof Notification === 'undefined' ? 'default' : Notification.permission,
    subscribed,
  })
}

async function send(method: 'POST' | 'DELETE', body: unknown): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/push/subscribe', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  }
  catch {
    throw new Error('서버에 연결하지 못했어요')
  }
  if (res.status === 403)
    throw new Error('이 Mac이나 tailnet에서만 바꿀 수 있어요')
  if (!res.ok)
    throw new Error('알림 설정을 바꾸지 못했어요')
}

function sameKey(current: ArrayBuffer | null | undefined, key: Uint8Array): boolean {
  if (!current)
    return false
  const bytes = new Uint8Array(current)
  return bytes.length === key.length && bytes.every((b, i) => b === key[i])
}

async function enable(): Promise<void> {
  const reg = await registration()
  if (!reg)
    return
  if (await Notification.requestPermission() !== 'granted')
    return
  const res = await fetch('/api/push/key').catch(() => null)
  if (!res?.ok)
    throw new Error('서버에 연결하지 못했어요')
  const { publicKey } = await res.json() as { publicKey: string }
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  let sub = await reg.pushManager.getSubscription()
  // Subscribed under another server key (a new data directory): that subscription can't hear this server
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  try {
    await send('POST', sub.toJSON())
  }
  catch (error) {
    // Never leave a subscription the server doesn't know about
    await sub.unsubscribe().catch(() => {})
    throw error
  }
}

async function disable(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription()
  if (!sub)
    return
  await send('DELETE', { endpoint: sub.endpoint })
  await sub.unsubscribe()
}

export function usePush() {
  /** Turns this device's notifications on or off; throws Error with the message to show */
  async function set(on: boolean): Promise<void> {
    busy.value = true
    try {
      await (on ? enable() : disable())
    }
    finally {
      await refresh().catch(() => {})
      busy.value = false
    }
  }
  return { state, busy, refresh, set }
}
