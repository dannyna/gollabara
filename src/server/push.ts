// Web Push (#64): a content-free ping to devices that opted in, when a session asks a question or
// answers the user's feedback. The payload is one fixed letter, encrypted end to end (RFC 8291) and
// signed with this server's VAPID key (RFC 8292). It leaves the machine through the browser vendor's
// push service, the one exception invariant 5 allows; no session text, name or image is ever in it.
//
// Written on WebCrypto rather than the `web-push` package: that package's last release is from January
// 2024 and brings five dependencies for what is about a hundred lines here, and owning the request
// keeps the timeout, the 404/410 cleanup and the payload test in this file.

import type { FeedbackVia, IncomingEvent, PushPayload, PushSubscriptionKeys } from '../shared/types'
import type { Store } from './store'
import { Buffer } from 'node:buffer'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** A push the service could not hand over in this long is dropped; ingestion never waits on it either way */
export const PUSH_TIMEOUT_MS = 10_000
/** A ping older than this is stale: the push service drops it rather than deliver it late */
const PUSH_TTL_S = 3600
/** The push service keeps only the newest undelivered ping under one topic, like the notification tag on the device */
const PUSH_TOPIC = 'gollabara'
/** RFC 8292 asks for a contact; this names the project, not a person */
const VAPID_SUBJECT = 'https://github.com/dannyna/gollabara'
const VAPID_FILE = 'vapid.json'
/** One record holds the whole payload; RFC 8188 record size */
const RECORD_SIZE = 4096

const subtle = globalThis.crypto.subtle
const P256 = { name: 'ECDH', namedCurve: 'P-256' } as const

export interface VapidKeys {
  /** Uncompressed P-256 point, base64url: the applicationServerKey browsers subscribe with */
  publicKey: string
  privateKey: JsonWebKey
}

const b64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url')
const fromB64url = (text: string) => new Uint8Array(Buffer.from(text, 'base64url'))
const utf8 = (text: string) => new TextEncoder().encode(text)
/** Joined into a fresh ArrayBuffer, as WebCrypto and fetch take it */
function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** The server's VAPID key pair, created once in the data directory, readable by this user only */
export async function loadVapidKeys(dir: string): Promise<VapidKeys> {
  const path = join(dir, VAPID_FILE)
  if (existsSync(path))
    return JSON.parse(readFileSync(path, 'utf8')) as VapidKeys
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const keys: VapidKeys = {
    publicKey: b64url(await subtle.exportKey('raw', pair.publicKey)),
    privateKey: await subtle.exportKey('jwk', pair.privateKey),
  }
  try {
    // `wx`: another start that got here first keeps its keys, which devices may already use
    writeFileSync(path, JSON.stringify(keys), { flag: 'wx', mode: 0o600 })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      return JSON.parse(readFileSync(path, 'utf8')) as VapidKeys
    throw error
  }
  // The mode above is masked by the umask
  chmodSync(path, 0o600)
  return keys
}

/** A subscription body as the browser serialises it, or null: https endpoint, 65-byte p256dh, 16-byte auth */
export function toSubscription(body: unknown): PushSubscriptionKeys | null {
  const { endpoint, keys } = (body ?? {}) as Partial<PushSubscriptionKeys>
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || typeof keys?.p256dh !== 'string' || typeof keys.auth !== 'string')
    return null
  try {
    if (new URL(endpoint).protocol !== 'https:')
      return null
  }
  catch {
    return null
  }
  if (fromB64url(keys.p256dh).length !== 65 || fromB64url(keys.auth).length !== 16)
    return null
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}

async function hkdf(salt: BufferSource, ikm: BufferSource, info: BufferSource, bytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

/** RFC 8291 aes128gcm: the body of a push message, readable only by the subscribed device */
export async function encryptPayload(plaintext: Uint8Array, sub: PushSubscriptionKeys): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = fromB64url(sub.keys.p256dh)
  const auth = fromB64url(sub.keys.auth)
  const local = await subtle.generateKey(P256, true, ['deriveBits']) as CryptoKeyPair
  const asPublic = new Uint8Array(await subtle.exportKey('raw', local.publicKey))
  const ua = await subtle.importKey('raw', uaPublic, P256, false, [])
  const shared = await subtle.deriveBits({ name: 'ECDH', public: ua }, local.privateKey, 256)

  const ikm = await hkdf(auth, shared, concat(utf8('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  // 0x02 marks the last (and only) record
  const record = concat(plaintext, Uint8Array.of(2))
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, record))

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** RFC 8292: `vapid t=<ES256 JWT for the push service's origin>, k=<public key>` */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const header = b64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: VAPID_SUBJECT })))
  const key = await subtle.importKey('jwk', keys.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  // WebCrypto signs in the raw r||s form JWS uses
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${header}.${claims}`))
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`
}

/** Sends one payload to one device; resolves to the push service's status */
export async function sendPush(sub: PushSubscriptionKeys, payload: PushPayload, keys: VapidKeys, fetcher: typeof fetch = fetch): Promise<number> {
  const body = await encryptPayload(utf8(JSON.stringify(payload)), sub)
  const res = await fetcher(sub.endpoint, {
    method: 'POST',
    headers: {
      'authorization': await vapidAuthorization(sub.endpoint, keys),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      'ttl': String(PUSH_TTL_S),
      'urgency': 'high',
      'topic': PUSH_TOPIC,
    },
    body,
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
  })
  return res.status
}

/**
 * What an event should ping devices with, if anything. A question always does. A recap does when it
 * answers feedback delivered to its session (`delivered`: how the latest delivery went in, null if none
 * is waiting for an answer). Feedback claimed at Stop continues the turn, so its answer is the
 * continuation recap; that Stop's own recap, which may arrive after the claim, is not it.
 */
export function pushFor(event: IncomingEvent, delivered: FeedbackVia | null): PushPayload | null {
  if (event.kind === 'question')
    return { t: 'q' }
  if (event.kind === 'recap' && delivered && (delivered !== 'stop' || event.continuation))
    return { t: 'r' }
  return null
}

export type PushSender = (sub: PushSubscriptionKeys, payload: PushPayload) => Promise<number>

/** Pings subscribed devices in the background; never blocks ingestion */
export class Pusher {
  /** Per session: how the latest feedback went in, until its answer arrives. Deliveries before this process started don't count. */
  private delivered = new Map<string, FeedbackVia>()
  private inflight = new Set<Promise<void>>()

  constructor(private store: Store, private send: PushSender) {}

  /** Called after an event is stored */
  onIngest(event: IncomingEvent): void {
    const sessionId = event.session.id
    const payload = pushFor(event, this.delivered.get(sessionId) ?? null)
    if (!payload)
      return
    if (payload.t === 'r')
      this.delivered.delete(sessionId)
    this.broadcast(payload)
  }

  /** Called when feedback reaches its session */
  onDelivered(sessionId: string, via: FeedbackVia): void {
    this.delivered.set(sessionId, via)
  }

  /** Resolves once every push in flight has settled */
  async idle(): Promise<void> {
    while (this.inflight.size)
      await Promise.all(this.inflight)
  }

  private broadcast(payload: PushPayload): void {
    for (const sub of this.store.pushSubscriptions()) {
      const job = this.send(sub, payload)
        .then((status) => {
          // The device unsubscribed or the subscription expired
          if (status === 404 || status === 410)
            this.store.deletePushSubscription(sub.endpoint)
        })
        // A timeout or a network failure loses this ping only; the subscription stays
        .catch(() => {})
        .finally(() => this.inflight.delete(job))
      this.inflight.add(job)
    }
  }
}
