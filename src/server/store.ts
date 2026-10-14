// Messages and sessions go to SQLite, images to files named by content hash. No third-party storage.

import type { Feedback, FeedbackImage, FeedbackVia, IncomingEvent, Session, SessionInfo, StoredImage, StreamMessage } from '../shared/types'
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Database } from 'bun:sqlite'
import { imageSize } from './image-size'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

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

/** Why feedback could not be queued */
export class FeedbackError extends Error {
  constructor(readonly status: 400 | 404, message: string) {
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
    this.db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      body TEXT NOT NULL
    )`)
    // open_turn: the turn message images join; last_turn: where a stop-hook continuation recap goes
    this.db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      harness TEXT NOT NULL,
      project TEXT,
      cwd TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      open_turn INTEGER,
      last_turn INTEGER
    )`)
    // image: stored file name; image_at / image_session: when and where it was captured, looked up once at queue time
    this.db.run(`CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      text TEXT NOT NULL,
      image TEXT,
      image_at INTEGER,
      image_session TEXT,
      created_at INTEGER NOT NULL,
      delivered_at INTEGER,
      delivered_via TEXT
    )`)
    this.db.run('CREATE INDEX IF NOT EXISTS feedback_pending ON feedback (session_id) WHERE delivered_at IS NULL')
  }

  /** Upserts the event's session, then stores the event in its turn. message is null if there is nothing to stream */
  ingest(event: IncomingEvent, now = Date.now()): Ingested {
    return this.db.transaction(() => this.ingestInTx(event, now))()
  }

  private ingestInTx(event: IncomingEvent, now: number): Ingested {
    const prev = this.db.query('SELECT * FROM sessions WHERE id = ?').get(event.session.id) as SessionRow | null
    const row = this.upsertSession(event.session, now)
    const session = toSession(row)
    let openTurn = prev && prev.open_turn !== null && now - prev.last_seen_at <= TURN_IDLE_MS ? prev.open_turn : null
    let lastTurn = prev?.last_turn ?? null
    const base = { at: now, sessionId: session.id, sessionName: session.name }
    let result: Ingested = { session, message: null, created: false }

    if (event.kind === 'question') {
      // Questions stand alone; they neither join nor close a turn
      result = { session, message: this.insert({ ...base, kind: 'question', questions: event.questions }), created: true }
    }
    else if (event.kind === 'image') {
      const images = event.images.map(i => ({ ...this.saveImage(i.data, i.mime, i.width, i.height), at: now }))
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

  sessions(): Session[] {
    const rows = this.db.query('SELECT * FROM sessions ORDER BY last_seen_at DESC').all() as SessionRow[]
    return rows.map(toSession)
  }

  /** Queues the user's feedback for a session. Throws FeedbackError for an unknown session or image. */
  queueFeedback(sessionId: string, text: string, image?: string, now = Date.now()): Feedback {
    if (!this.db.query('SELECT 1 FROM sessions WHERE id = ?').get(sessionId))
      throw new FeedbackError(404, 'unknown session')
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

  private upsertSession(info: SessionInfo, now: number): SessionRow {
    // Resumes reuse the session id, so startedAt keeps its first value. Older hooks send no harness.
    return this.db.query(`INSERT INTO sessions (id, name, harness, project, cwd, started_at, last_seen_at)
      VALUES ($id, $name, $harness, $project, $cwd, $now, $now)
      ON CONFLICT(id) DO UPDATE SET name = $name, harness = $harness, project = $project, cwd = $cwd, last_seen_at = $now
      RETURNING *`).get({
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

  private saveImage(base64: string, mime: string, width?: number, height?: number): StoredImage {
    const bytes = Buffer.from(base64, 'base64')
    const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex').slice(0, 32)
    const name = `${hash}.${EXT[mime] ?? 'png'}`
    const path = join(this.imageDir, name)
    if (!existsSync(path))
      writeFileSync(path, bytes)
    const size = width && height ? { width, height } : imageSize(bytes) ?? { width: 16, height: 10 }
    return { url: `/img/${name}`, ...size }
  }
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
  }
}
