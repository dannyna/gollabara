// Messages and sessions go to SQLite, images to files named by content hash. No third-party storage.

import type { Feedback, FeedbackImage, FeedbackVia, Harness, HistoryDay, HistoryPage, HookSeen, IncomingEvent, IncomingImage, PushSubscriptionKeys, Retention, ServerSettings, Session, SessionInfo, StoredImage, StreamMessage, Tone, Triage, TriageEngine, Verdict } from '../shared/types'
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Database } from 'bun:sqlite'
import { hookOutdated } from '../shared/version'
import { dHash } from './dhash'
import { imageSize } from './image-size'
import { migrate } from './migrations'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

export const TRIAGE_ENGINES: TriageEngine[] = ['off', 'claude', 'codex']
export const RETENTIONS: Retention[] = ['7', '30', 'forever']

/** What a prune or a session delete removed: the rows for the views to drop, and the image files */
export interface Purged {
  messageIds: number[]
  feedbackIds: number[]
  sessionIds: string[]
  files: string[]
}

/**
 * Larger captures are not decoded for a dHash; they still group by identical bytes.
 * JPEG decoding runs about 14 ms per megapixel, so 12 MP stays near 170 ms and the
 * hook's parallel feedback claim never waits out its 1.5 s budget behind it.
 */
const DHASH_MAX_PIXELS = 12_000_000

/** A crashed session never sends Stop, so an open turn closes after this long without events */
export const TURN_IDLE_MS = 10 * 60 * 1000

/** What one event changed: the session record, and the message it created or updated */
export interface Ingested {
  session: Session
  message: StreamMessage | null
  /** true when `message` is new, false when an existing message changed in place */
  created: boolean
}

interface SessionRow {
  id: string
  name: string
  harness: Session['harness']
  project: string | null
  cwd: string
  started_at: number
  last_seen_at: number
  open_turn: number | null
  last_turn: number | null
  pid: number | null
  ended_at: number | null
  pid_at: number | null
}

interface FeedbackRow {
  id: number
  session_id: string
  text: string
  image: string | null
  image_at: number | null
  image_session: string | null
  created_at: number
  delivered_at: number | null
  delivered_via: FeedbackVia | null
}

/** A session's harness process, as its latest SessionStart linked it: `at` is when, null on links from before #76 */
export interface PidLink {
  id: string
  pid: number
  at: number | null
}

/** Where a history page starts: past one end of a loaded run, at a time, or (none) at the latest */
export interface HistoryCursor {
  before?: number
  after?: number
  from?: number
}

/** Why feedback could not be queued */
export class FeedbackError extends Error {
  constructor(readonly status: 400 | 404 | 409, message: string) {
    super(message)
  }
}

export class Store {
  private db: Database
  readonly imageDir: string

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true })
    this.imageDir = join(dir, 'images')
    mkdirSync(this.imageDir, { recursive: true })
    this.db = new Database(join(dir, 'stream.db'))
    this.db.run('PRAGMA journal_mode = WAL')
    migrate(this.db)
  }

  settings(): ServerSettings {
    const rows = this.db.query('SELECT key, value FROM settings').all() as { key: string, value: string }[]
    const stored = new Map(rows.map(r => [r.key, r.value]))
    const triage = stored.get('triage')
    const retention = stored.get('retention')
    const phone = stored.get('phone')
    return {
      triage: triage && (TRIAGE_ENGINES as string[]).includes(triage) ? triage as TriageEngine : 'off',
      ...(retention && (RETENTIONS as string[]).includes(retention) ? { retention: retention as Retention } : {}),
      ...(phone !== undefined ? { phone } : {}),
    }
  }

  /** Stores the given keys. With `seed`, only keys never saved: a stale device can't overwrite another's choice. */
  saveSettings(patch: Partial<ServerSettings>, seed = false): ServerSettings {
    const write = this.db.query(`INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO ${seed ? 'NOTHING' : 'UPDATE SET value = excluded.value'}`)
    this.db.transaction(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined)
          write.run(key, value)
      }
    })()
    return this.settings()
  }

  saveTriage(t: Triage): void {
    this.db.run(`INSERT INTO triage (message_id, idx, verdict, tone) VALUES (?, ?, ?, ?)
      ON CONFLICT(message_id, idx) DO UPDATE SET verdict = excluded.verdict, tone = excluded.tone`, [t.messageId, t.index, t.verdict, t.tone ?? null])
  }

  /** Verdicts for the given messages (those `recent()` returns) */
  triageFor(messageIds: number[]): Triage[] {
    if (!messageIds.length)
      return []
    const rows = this.db.query(`SELECT message_id, idx, verdict, tone FROM triage WHERE message_id >= ? AND message_id <= ? ORDER BY message_id, idx`)
      .all(Math.min(...messageIds), Math.max(...messageIds)) as { message_id: number, idx: number, verdict: Verdict, tone: Tone | null }[]
    const ids = new Set(messageIds)
    return rows.filter(r => ids.has(r.message_id)).map(r => ({ messageId: r.message_id, index: r.idx, verdict: r.verdict, ...(r.tone ? { tone: r.tone } : {}) }))
  }

  /** A hit counts as use, so a line that keeps recurring stays cached past the retention window */
  cachedVerdict(key: string, now = Date.now()): Verdict | null {
    const row = this.db.query('UPDATE triage_cache SET seen_at = ? WHERE key = ? RETURNING verdict').get(now, key) as { verdict: Verdict } | null
    return row?.verdict ?? null
  }

  cacheVerdict(key: string, verdict: Verdict, now = Date.now()): void {
    this.db.run(`INSERT INTO triage_cache (key, verdict, seen_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET verdict = excluded.verdict, seen_at = excluded.seen_at`, [key, verdict, now])
  }

  /** Records the hook a harness last ran: `version` is null when the hook sent none */
  seeHook(harness: Harness, version: string | null, now = Date.now()): void {
    this.db.run(`INSERT INTO hook_versions (harness, version, seen_at) VALUES (?, ?, ?)
      ON CONFLICT(harness) DO UPDATE SET version = excluded.version, seen_at = excluded.seen_at`, [harness, version, now])
  }

  /** The latest hook seen per harness, most recent first */
  hooks(expected?: string): HookSeen[] {
    const rows = this.db.query('SELECT harness, version, seen_at FROM hook_versions ORDER BY seen_at DESC').all() as { harness: Harness, version: string | null, seen_at: number }[]
    return rows.map(r => ({ harness: r.harness, version: r.version, seenAt: r.seen_at, outdated: hookOutdated(r.version, expected) }))
  }

  /** Adds or refreshes a device's push subscription; one row per endpoint */
  savePushSubscription(sub: PushSubscriptionKeys, now = Date.now()): void {
    this.db.run(`INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`, [sub.endpoint, sub.keys.p256dh, sub.keys.auth, now])
  }

  deletePushSubscription(endpoint: string): void {
    this.db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint])
  }

  pushSubscriptions(): PushSubscriptionKeys[] {
    const rows = this.db.query('SELECT endpoint, p256dh, auth FROM push_subscriptions ORDER BY created_at').all() as { endpoint: string, p256dh: string, auth: string }[]
    return rows.map(r => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }))
  }

  /**
   * Retention: deletes messages and feedback from before `before`, their triage, sessions not seen
   * since, and cached hide verdicts not written or used since, then the image files nothing left references.
   */
  prune(before: number): Purged {
    return this.purge({ messages: 'at < $key', feedback: 'created_at < $key', sessions: 'last_seen_at < $key', cache: 'seen_at < $key' }, { $key: before })
  }

  /** 「이 세션 데이터 삭제」: the session, its messages, feedback and triage, and images no other row references */
  deleteSession(id: string): Purged {
    return this.purge({ messages: `json_extract(body, '$.sessionId') = $key`, feedback: 'session_id = $key', sessions: 'id = $key' }, { $key: id })
  }

  /**
   * Removes feedback still queued for a session: the given ids, or all of it. Delivered items stay, so an
   * item a hook claimed in the meantime is never taken back. Images only these items named go too.
   */
  discardFeedback(sessionId: string, ids?: number[]): Purged {
    const only = ids ? ' AND id IN (SELECT value FROM json_each($ids))' : ''
    return this.purge({ messages: '0', feedback: `session_id = $key AND delivered_at IS NULL${only}`, sessions: '0' }, { $key: sessionId, ...(ids ? { $ids: JSON.stringify(ids) } : {}) })
  }

  /**
   * Images are shared by hash, so a file goes only when no remaining message or feedback names it.
   * Synchronous throughout: ingest writes a file and then inserts its message without yielding, so no
   * prune can fall between the two and take a file a new message is about to use.
   */
  private purge(where: Record<'messages' | 'feedback' | 'sessions', string> & { cache?: string }, params: Record<string, string | number>): Purged {
    const { purged, orphans } = this.db.transaction(() => {
      const messages = this.db.query(`DELETE FROM messages WHERE ${where.messages} RETURNING id, body`).all(params) as { id: number, body: string }[]
      const feedback = this.db.query(`DELETE FROM feedback WHERE ${where.feedback} RETURNING id, image`).all(params) as { id: number, image: string | null }[]
      const sessions = this.db.query(`DELETE FROM sessions WHERE ${where.sessions} RETURNING id`).all(params) as { id: string }[]
      if (where.cache)
        this.db.query(`DELETE FROM triage_cache WHERE ${where.cache}`).run(params)
      if (messages.length)
        this.db.run('DELETE FROM triage WHERE message_id NOT IN (SELECT id FROM messages)')
      const candidates = new Set([...messages.flatMap(m => imageNames(m.body)), ...feedback.flatMap(f => f.image ? [f.image] : [])])
      if (candidates.size) {
        const rows = this.db.query(`SELECT body FROM messages WHERE instr(body, '"/img/') > 0`).all() as { body: string }[]
        for (const row of rows) {
          for (const name of imageNames(row.body)) candidates.delete(name)
        }
        const quoted = this.db.query('SELECT image FROM feedback WHERE image IS NOT NULL').all() as { image: string }[]
        for (const row of quoted) candidates.delete(row.image)
      }
      return {
        purged: { messageIds: messages.map(m => m.id), feedbackIds: feedback.map(f => f.id), sessionIds: sessions.map(s => s.id) },
        orphans: [...candidates],
      }
    })()
    const files = orphans.filter((name) => {
      try {
        unlinkSync(join(this.imageDir, name))
        return true
      }
      catch {
        return false
      }
    })
    return { ...purged, files }
  }

  /** One stored message, or null */
  get(id: number): StreamMessage | null {
    return this.message(id)
  }

  /** The session's latest messages before `beforeId`, oldest first: context for triage */
  previous(sessionId: string, beforeId: number, limit: number): StreamMessage[] {
    const rows = this.db.query(`SELECT id, body FROM messages WHERE id < ? AND json_extract(body, '$.sessionId') = ?
      ORDER BY id DESC LIMIT ?`).all(beforeId, sessionId, limit) as { id: number, body: string }[]
    return rows.reverse().map(r => ({ id: r.id, ...JSON.parse(r.body) }))
  }

  /** Upserts the event's session, then stores the event in its turn. message is null if there is nothing to stream */
  ingest(event: IncomingEvent, now = Date.now()): Ingested {
    // Files and hashes first: decoding for the dHash is slow and needs no lock
    const saved = event.kind === 'image' ? event.images.map(i => this.saveImage(i)) : []
    return this.db.transaction(() => this.ingestInTx(event, saved, now))()
  }

  private ingestInTx(event: IncomingEvent, saved: StoredImage[], now: number): Ingested {
    const prev = this.db.query('SELECT * FROM sessions WHERE id = ?').get(event.session.id) as SessionRow | null
    // Any event from an ended session means it is running again (a resume); a session-end ends it
    const row = this.upsertSession(event.session, now, event.kind === 'session-end' ? now : null)
    const session = toSession(row)
    let openTurn = prev && prev.open_turn !== null && now - prev.last_seen_at <= TURN_IDLE_MS ? prev.open_turn : null
    let lastTurn = prev?.last_turn ?? null
    const base = { at: now, sessionId: session.id, sessionName: session.name }
    let result: Ingested = { session, message: null, created: false }

    if (event.kind === 'session' && event.pid) {
      // /clear and resume start a new session in the same process: the latest SessionStart owns the pid
      // The session that held it no longer runs there, so it ended, even when its own session-end never came
      this.db.run('UPDATE sessions SET pid = NULL, ended_at = coalesce(ended_at, ?) WHERE pid = ? AND id != ?', [now, event.pid, session.id])
      this.db.run('UPDATE sessions SET pid = ?, pid_at = ? WHERE id = ?', [event.pid, now, session.id])
    }
    else if (event.kind === 'session-end') {
      // The process is leaving, and a later process may get its pid; a turn left open closes
      this.db.run('UPDATE sessions SET pid = NULL WHERE id = ?', [session.id])
      openTurn = null
    }
    else if (event.kind === 'question') {
      // Questions stand alone; they neither join nor close a turn
      result = { session, message: this.insert({ ...base, kind: 'question', questions: event.questions }), created: true }
    }
    else if (event.kind === 'image') {
      const images = saved.map(i => ({ ...i, at: now }))
      const open = openTurn !== null ? this.message(openTurn) : null
      if (open) {
        result = { session, message: this.update({ ...open, images: [...(open.images ?? []), ...images] }), created: false }
      }
      else {
        result = { session, message: this.insert({ ...base, kind: 'turn', images }), created: true }
        openTurn = lastTurn = result.message!.id
      }
    }
    else if (event.kind === 'recap') {
      // Stop closes the open turn; a continuation recap joins the latest turn, already closed by the first Stop
      const target = event.continuation ? (openTurn ?? lastTurn) : openTurn
      const existing = target !== null ? this.message(target) : null
      if (existing) {
        result = { session, message: this.update(withRecap(existing, event.text)), created: false }
      }
      else {
        result = { session, message: this.insert(withRecap({ ...base, kind: 'turn' }, event.text)), created: true }
        lastTurn = result.message!.id
      }
      openTurn = null
    }

    this.db.run('UPDATE sessions SET open_turn = ?, last_turn = ? WHERE id = ?', [openTurn, lastTurn, session.id])
    return result
  }

  recent(limit = 300): StreamMessage[] {
    const rows = this.db.query('SELECT id, body FROM messages ORDER BY id DESC LIMIT ?').all(limit) as { id: number, body: string }[]
    return rows.reverse().map(r => ({ id: r.id, ...JSON.parse(r.body) }))
  }

  /** Whether any message is older than `id` */
  hasOlder(id: number): boolean {
    return this.db.query('SELECT 1 FROM messages WHERE id < ? LIMIT 1').get(id) !== null
  }

  /**
   * A page of history (#77), oldest first. Ids grow with `at`, so paging by id is paging in time:
   * `before` and `after` extend a loaded run at either end, `from` (ms) starts a run at the first
   * message stored then or later, and no cursor gives the latest messages. The page's feedback is
   * what was sent between its first message and the message after its last one, so pages laid end
   * to end hold each bubble once.
   */
  history(cursor: HistoryCursor, limit: number): HistoryPage {
    let rows: { id: number, at: number, body: string }[]
    if (cursor.before !== undefined) {
      rows = (this.db.query('SELECT id, at, body FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?').all(cursor.before, limit) as typeof rows).reverse()
    }
    else if (cursor.after !== undefined) {
      rows = this.db.query('SELECT id, at, body FROM messages WHERE id > ? ORDER BY id LIMIT ?').all(cursor.after, limit) as typeof rows
    }
    else if (cursor.from !== undefined) {
      // messages_at finds the first one; the run then follows the ids
      const first = this.db.query('SELECT id FROM messages WHERE at >= ? ORDER BY at, id LIMIT 1').get(cursor.from) as { id: number } | null
      rows = first ? this.db.query('SELECT id, at, body FROM messages WHERE id >= ? ORDER BY id LIMIT ?').all(first.id, limit) as typeof rows : []
    }
    else {
      rows = (this.db.query('SELECT id, at, body FROM messages ORDER BY id DESC LIMIT ?').all(limit) as typeof rows).reverse()
    }
    const messages: StreamMessage[] = rows.map(r => ({ id: r.id, ...JSON.parse(r.body) }))
    const first = rows[0]
    const last = rows.at(-1)
    if (!first || !last) {
      // Nothing past the cursor: what lies before it, for a jump past the last message
      const older = cursor.after !== undefined ? this.hasOlder(cursor.after + 1) : cursor.from !== undefined && this.hasOlder(Number.MAX_SAFE_INTEGER)
      return { messages, triage: [], feedback: [], older, newer: false }
    }
    const older = this.hasOlder(first.id)
    const next = this.db.query('SELECT at FROM messages WHERE id > ? ORDER BY id LIMIT 1').get(last.id) as { at: number } | null
    const feedback = this.db.query('SELECT * FROM feedback WHERE created_at >= ? AND created_at < ? ORDER BY id')
      .all(older ? first.at : -Number.MAX_SAFE_INTEGER, next?.at ?? Number.MAX_SAFE_INTEGER) as FeedbackRow[]
    return {
      messages,
      triage: this.triageFor(messages.map(m => m.id)),
      feedback: feedback.map(r => this.toFeedback(r)),
      older,
      newer: next !== null,
    }
  }

  /**
   * Local days that hold messages, newest first, for the day jump. `offset` is the view's UTC offset
   * in minutes (east positive); grouping reads only messages_at, or messages_session for one session.
   */
  days(offset: number, sessionId?: string): HistoryDay[] {
    const shift = offset * 60_000
    const where = sessionId ? `WHERE json_extract(body, '$.sessionId') = $session` : ''
    const rows = this.db.query(`SELECT CAST((at + $shift) / 86400000 AS INTEGER) AS day, count(*) AS n FROM messages ${where} GROUP BY day ORDER BY day DESC`)
      .all({ $shift: shift, ...(sessionId ? { $session: sessionId } : {}) }) as { day: number, n: number }[]
    return rows.map(r => ({ start: r.day * 86_400_000 - shift, count: r.n }))
  }

  sessions(): Session[] {
    const rows = this.db.query('SELECT * FROM sessions ORDER BY last_seen_at DESC').all() as SessionRow[]
    return rows.map(toSession)
  }

  session(id: string): Session | null {
    const row = this.db.query('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | null
    return row ? toSession(row) : null
  }

  /** Running sessions that know their harness process, for the liveness sweep */
  pidLinks(): PidLink[] {
    const rows = this.db.query('SELECT id, pid, pid_at FROM sessions WHERE pid IS NOT NULL AND ended_at IS NULL').all() as { id: string, pid: number, pid_at: number | null }[]
    return rows.map(r => ({ id: r.id, pid: r.pid, at: r.pid_at }))
  }

  /** Marks running sessions ended (their process is gone) and returns them; sessions already ended are left alone */
  endSessions(ids: string[], now = Date.now()): Session[] {
    return ids.flatMap((id) => {
      const row = this.db.query('UPDATE sessions SET ended_at = ?, pid = NULL WHERE id = ? AND ended_at IS NULL RETURNING *').get(now, id) as SessionRow | null
      return row ? [toSession(row)] : []
    })
  }

  /** The session running in the harness process `pid`, or null before its SessionStart arrived */
  sessionForPid(pid: number): string | null {
    const row = this.db.query('SELECT id FROM sessions WHERE pid = ?').get(pid) as { id: string } | null
    return row?.id ?? null
  }

  /** Queues the user's feedback for a session. Throws FeedbackError for an unknown or ended session, or an unknown image. */
  queueFeedback(sessionId: string, text: string, image?: string, now = Date.now()): Feedback {
    const session = this.db.query('SELECT ended_at FROM sessions WHERE id = ?').get(sessionId) as { ended_at: number | null } | null
    if (!session)
      throw new FeedbackError(404, 'unknown session')
    // Nothing would ever pick it up; a resume makes the session reachable again
    if (session.ended_at !== null)
      throw new FeedbackError(409, 'session ended')
    let ref: { name: string, at: number, sessionName: string | null } | null = null
    if (image) {
      // Same sanitising as the /img/ route, so the ref cannot leave the image directory
      const name = image.replace(/^\/img\//, '').replace(/[^\w.]/g, '')
      const path = join(this.imageDir, name)
      if (!name || name.startsWith('.') || !existsSync(path))
        throw new FeedbackError(400, 'unknown image')
      const capture = this.imageCapture(name)
      ref = { name, at: capture?.at ?? Math.round(statSync(path).mtimeMs), sessionName: capture?.sessionName ?? null }
    }
    const row = this.db.query(`INSERT INTO feedback (session_id, text, image, image_at, image_session, created_at)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING *`).get(sessionId, text, ref?.name ?? null, ref?.at ?? null, ref?.sessionName ?? null, now) as FeedbackRow
    return this.toFeedback(row)
  }

  /** Marks every queued item for the session delivered and returns them, oldest first. One statement, so two hooks never get the same item. */
  claimFeedback(sessionId: string, via: FeedbackVia, now = Date.now()): Feedback[] {
    const rows = this.db.query(`UPDATE feedback SET delivered_at = ?, delivered_via = ?
      WHERE session_id = ? AND delivered_at IS NULL RETURNING *`).all(now, via, sessionId) as FeedbackRow[]
    return rows.sort((a, b) => a.id - b.id).map(r => this.toFeedback(r))
  }

  /** The feedback most recently delivered to the session, or null */
  lastDelivered(sessionId: string): Feedback | null {
    const row = this.db.query(`SELECT * FROM feedback WHERE session_id = ? AND delivered_at IS NOT NULL
      ORDER BY delivered_at DESC, id DESC LIMIT 1`).get(sessionId) as FeedbackRow | null
    return row ? this.toFeedback(row) : null
  }

  recentFeedback(limit = 300): Feedback[] {
    const rows = this.db.query('SELECT * FROM feedback ORDER BY id DESC LIMIT ?').all(limit) as FeedbackRow[]
    return rows.reverse().map(r => this.toFeedback(r))
  }

  /** There is no images table: the latest message holding the image says when and by whom it was captured */
  private imageCapture(name: string): { at: number, sessionName: string } | null {
    const url = `/img/${name}`
    const rows = this.db.query('SELECT id, body FROM messages WHERE instr(body, ?) > 0 ORDER BY id DESC LIMIT 20').all(`"${url}"`) as { id: number, body: string }[]
    for (const row of rows) {
      const message = JSON.parse(row.body) as Omit<StreamMessage, 'id'>
      const stored = message.images?.find(i => i.url === url)
      if (stored)
        return { at: stored.at ?? message.at, sessionName: message.sessionName }
    }
    return null
  }

  private toFeedback(row: FeedbackRow): Feedback {
    const image: FeedbackImage | undefined = row.image
      ? {
          url: `/img/${row.image}`,
          // Absolute even when GOLLABARA_DATA is relative: the session opens it from its own cwd
          path: resolve(this.imageDir, row.image),
          at: row.image_at ?? row.created_at,
          ...(row.image_session ? { sessionName: row.image_session } : {}),
        }
      : undefined
    return {
      id: row.id,
      sessionId: row.session_id,
      text: row.text,
      ...(image ? { image } : {}),
      createdAt: row.created_at,
      ...(row.delivered_at !== null ? { deliveredAt: row.delivered_at, deliveredVia: row.delivered_via! } : {}),
    }
  }

  private upsertSession(info: SessionInfo, now: number, endedAt: number | null): SessionRow {
    // Resumes reuse the session id, so startedAt keeps its first value. Older hooks send no harness.
    return this.db.query(`INSERT INTO sessions (id, name, harness, project, cwd, started_at, last_seen_at, ended_at)
      VALUES ($id, $name, $harness, $project, $cwd, $now, $now, $ended)
      ON CONFLICT(id) DO UPDATE SET name = $name, harness = $harness, project = $project, cwd = $cwd, last_seen_at = $now, ended_at = $ended
      RETURNING *`).get({
      $ended: endedAt,
      $id: info.id,
      $name: info.name,
      $harness: info.harness ?? 'claude-code',
      $project: info.project ?? null,
      $cwd: info.cwd,
      $now: now,
    }) as SessionRow
  }

  private message(id: number): StreamMessage | null {
    const row = this.db.query('SELECT id, body FROM messages WHERE id = ?').get(id) as { id: number, body: string } | null
    return row ? { id: row.id, ...JSON.parse(row.body) } : null
  }

  private insert(draft: Omit<StreamMessage, 'id'>): StreamMessage {
    const row = this.db.query('INSERT INTO messages (at, body) VALUES (?, ?) RETURNING id').get(draft.at, JSON.stringify(draft)) as { id: number }
    return { id: row.id, ...draft }
  }

  private update(message: StreamMessage): StreamMessage {
    const { id, ...body } = message
    this.db.run('UPDATE messages SET body = ? WHERE id = ?', [JSON.stringify(body), id])
    return message
  }

  // Images live in the message body JSON, so `source`, `dhash` and `role` need no column; older bodies simply lack them
  private saveImage({ data, mime, width, height, source, role }: IncomingImage): StoredImage {
    const bytes = Buffer.from(data, 'base64')
    const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex').slice(0, 32)
    const name = `${hash}.${EXT[mime] ?? 'png'}`
    const path = join(this.imageDir, name)
    if (!existsSync(path))
      writeFileSync(path, bytes)
    const size = width && height ? { width, height } : imageSize(bytes) ?? { width: 16, height: 10 }
    const kept = role ? { role } : {}
    if (!source)
      return { url: `/img/${name}`, ...size, ...kept }
    // Only a named file can be re-captured, so only those need the dHash; huge images skip it
    const dhash = size.width * size.height <= DHASH_MAX_PIXELS ? dHash(bytes, mime) : null
    return { url: `/img/${name}`, ...size, source, ...(dhash ? { dhash } : {}), ...kept }
  }
}

/** Stored image names a message body refers to (`"/img/<name>"`) */
function imageNames(body: string): string[] {
  return [...body.matchAll(/"\/img\/([\w.]+)"/g)].map(m => m[1]!)
}

function withRecap<T extends Omit<StreamMessage, 'id'>>(message: T, text: string): T {
  const recaps = [...(message.recaps ?? []), text]
  return { ...message, recaps, text: recaps.join('\n') }
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    harness: row.harness,
    ...(row.project ? { project: row.project } : {}),
    cwd: row.cwd,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    ...(row.ended_at !== null ? { endedAt: row.ended_at } : {}),
  }
}
