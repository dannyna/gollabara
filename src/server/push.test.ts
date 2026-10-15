import type { IncomingEvent, PushPayload, PushSubscriptionKeys, SessionInfo } from '../shared/types'
import { Buffer } from 'node:buffer'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { loadVapidKeys, Pusher, pushFor, sendPush, toSubscription } from './push'
import { Store } from './store'

const subtle = globalThis.crypto.subtle
const a: SessionInfo = { id: 'a', name: 'secret-project · launch-branch', harness: 'claude-code', cwd: '/a' }
const recap = (text: string, continuation?: boolean): IncomingEvent => ({ kind: 'recap', session: a, text, ...(continuation ? { continuation } : {}) })
const question: IncomingEvent = { kind: 'question', session: a, questions: [{ question: 'Deploy the payroll migration now?', options: [{ label: 'Yes' }] }] }

/** A device: its subscription and the private key the push service's payload decrypts with */
async function device(endpoint = 'https://push.example/sub/1') {
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const auth = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const p256dh = new Uint8Array(await subtle.exportKey('raw', pair.publicKey))
  const sub: PushSubscriptionKeys = { endpoint, keys: { p256dh: Buffer.from(p256dh).toString('base64url'), auth: Buffer.from(auth).toString('base64url') } }
  return { sub, privateKey: pair.privateKey, p256dh, auth }
}

/** RFC 8291 decryption, as the browser does it */
async function decrypt(body: Uint8Array, d: Awaited<ReturnType<typeof device>>): Promise<string> {
  const salt = body.slice(0, 16)
  const idlen = body[20]!
  const asPublic = body.slice(21, 21 + idlen)
  const ciphertext = body.slice(21 + idlen)
  const as = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = await subtle.deriveBits({ name: 'ECDH', public: as }, d.privateKey, 256)
  const hkdf = async (s: BufferSource, ikm: BufferSource, info: BufferSource, n: number) =>
    new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8))
  const enc = (t: string) => new TextEncoder().encode(t)
  const ikm = await hkdf(d.auth, shared, new Uint8Array([...enc('WebPush: info\0'), ...d.p256dh, ...asPublic]), 32)
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12)
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const record = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext))
  expect(record.at(-1)).toBe(2)
  return new TextDecoder().decode(record.slice(0, -1))
}

let dir: string
let store: Store
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gollabara-push-'))
  store = new Store(dir)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

/** A Pusher that records what it would send */
function recording() {
  const sent: PushPayload[] = []
  const pusher = new Pusher(store, async (_, payload) => {
    sent.push(payload)
    return 201
  })
  return { pusher, sent }
}

describe('pushFor', () => {
  test('a question always pings', () => {
    expect(pushFor(question, null)).toEqual({ t: 'q' })
  })

  test('a recap pings only when it answers delivered feedback', () => {
    expect(pushFor(recap('done'), null)).toBeNull()
    for (const via of ['post-tool-use', 'user-prompt-submit', 'rewake'] as const)
      expect(pushFor(recap('done'), via)).toEqual({ t: 'r' })
  })

  test('feedback claimed at Stop is answered by the continuation recap, not that Stop\'s own', () => {
    expect(pushFor(recap('first stop'), 'stop')).toBeNull()
    expect(pushFor(recap('answer', true), 'stop')).toEqual({ t: 'r' })
  })

  test('images and session starts never ping', () => {
    expect(pushFor({ kind: 'session', session: a }, 'post-tool-use')).toBeNull()
    expect(pushFor({ kind: 'image', session: a, toolName: 'Read', images: [] }, 'post-tool-use')).toBeNull()
  })
})

describe('Pusher', () => {
  beforeEach(async () => store.savePushSubscription((await device()).sub))

  test('a question pings every subscribed device', async () => {
    const { pusher, sent } = recording()
    pusher.onIngest(question)
    await pusher.idle()
    expect(sent).toEqual([{ t: 'q' }])
  })

  test('only the first recap after delivered feedback pings', async () => {
    const { pusher, sent } = recording()
    pusher.onIngest(recap('before feedback'))
    pusher.onDelivered('a', 'post-tool-use')
    pusher.onIngest(recap('the answer'))
    pusher.onIngest(recap('a later turn'))
    await pusher.idle()
    expect(sent).toEqual([{ t: 'r' }])
  })

  test('a Stop claim that lands before or after its own recap waits for the continuation', async () => {
    for (const claimFirst of [true, false]) {
      const { pusher, sent } = recording()
      if (claimFirst)
        pusher.onDelivered('a', 'stop')
      pusher.onIngest(recap('stop recap'))
      if (!claimFirst)
        pusher.onDelivered('a', 'stop')
      await pusher.idle()
      expect(sent).toEqual([])
      pusher.onIngest(recap('the answer', true))
      await pusher.idle()
      expect(sent).toEqual([{ t: 'r' }])
    }
  })

  test('feedback to another session does not make this one ping', async () => {
    const { pusher, sent } = recording()
    pusher.onDelivered('b', 'post-tool-use')
    pusher.onIngest(recap('unrelated'))
    await pusher.idle()
    expect(sent).toEqual([])
  })

  test('404 and 410 drop the subscription; other failures keep it', async () => {
    store.savePushSubscription((await device('https://push.example/sub/gone')).sub)
    store.savePushSubscription((await device('https://push.example/sub/down')).sub)
    const pusher = new Pusher(store, async (sub) => {
      if (sub.endpoint.endsWith('gone'))
        return 410
      if (sub.endpoint.endsWith('down'))
        throw new Error('timeout')
      return 201
    })
    pusher.onIngest(question)
    await pusher.idle()
    expect(store.pushSubscriptions().map(s => s.endpoint)).toEqual(['https://push.example/sub/1', 'https://push.example/sub/down'])
  })
})

describe('sendPush', () => {
  test('the encrypted payload holds only the fixed letter, never session text or a name', async () => {
    const d = await device()
    store.deletePushSubscription('https://push.example/sub/1')
    store.savePushSubscription(d.sub)
    const keys = await loadVapidKeys(dir)
    const requests: { url: string, init: RequestInit }[] = []
    const fetcher = (async (url: string, init: RequestInit) => {
      requests.push({ url, init })
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch
    const pusher = new Pusher(store, (sub, payload) => sendPush(sub, payload, keys, fetcher))
    store.ingest(question)
    pusher.onIngest(question)
    pusher.onDelivered('a', 'rewake')
    pusher.onIngest(recap('Shipped the payroll migration to launch-branch'))
    await pusher.idle()

    expect(requests).toHaveLength(2)
    const plain = await Promise.all(requests.map(r => decrypt(r.init.body as Uint8Array, d)))
    // Both go out concurrently, so either may reach the service first
    expect(plain.sort()).toEqual(['{"t":"q"}', '{"t":"r"}'])
    for (const text of plain) {
      for (const secret of ['payroll', 'secret-project', 'launch-branch', 'Deploy', 'Shipped'])
        expect(text).not.toContain(secret)
    }
    const headers = requests[0]!.init.headers as Record<string, string>
    expect(requests[0]!.url).toBe(d.sub.endpoint)
    expect(headers['content-encoding']).toBe('aes128gcm')
    expect(headers.authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.publicKey}$`))
  })

  test('the VAPID JWT is signed for the push service\'s origin and verifies with the public key', async () => {
    const keys = await loadVapidKeys(dir)
    let auth = ''
    const fetcher = (async (_: string, init: RequestInit) => {
      auth = (init.headers as Record<string, string>).authorization!
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch
    await sendPush((await device('https://fcm.googleapis.com/fcm/send/abc')).sub, { t: 'q' }, keys, fetcher)
    const [, jwt] = auth.match(/t=([^,]+)/)!
    const [header, claims, signature] = jwt!.split('.') as [string, string, string]
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({ aud: 'https://fcm.googleapis.com' })
    const publicKey = await subtle.importKey('raw', Buffer.from(keys.publicKey, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, Buffer.from(signature, 'base64url'), new TextEncoder().encode(`${header}.${claims}`))
    expect(ok).toBe(true)
  })
})

describe('loadVapidKeys', () => {
  test('creates the key pair once, readable by this user only', async () => {
    const first = await loadVapidKeys(dir)
    expect(Buffer.from(first.publicKey, 'base64url')).toHaveLength(65)
    expect(statSync(join(dir, 'vapid.json')).mode & 0o777).toBe(0o600)
    expect(await loadVapidKeys(dir)).toEqual(first)
  })
})

describe('toSubscription', () => {
  test('takes a browser subscription and refuses anything else', async () => {
    const { sub } = await device()
    expect(toSubscription({ ...sub, expirationTime: null })).toEqual(sub)
    expect(toSubscription(null)).toBeNull()
    expect(toSubscription({ ...sub, endpoint: 'http://push.example/x' })).toBeNull()
    expect(toSubscription({ ...sub, keys: { ...sub.keys, auth: 'AAAA' } })).toBeNull()
    expect(toSubscription({ ...sub, keys: { ...sub.keys, p256dh: 'AAAA' } })).toBeNull()
  })
})
