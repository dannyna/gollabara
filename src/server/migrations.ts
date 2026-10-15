// Schema changes are numbered migrations. PRAGMA user_version records the last one applied,
// so each runs once, in order, inside its own transaction. Never edit a shipped migration; append one.

import type { Database } from 'bun:sqlite'

type Migration = (db: Database) => void

function hasColumn(db: Database, table: string, column: string): boolean {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return columns.some(c => c.name === column)
}

export const MIGRATIONS: Migration[] = [
  // 1: the schema as it stood before versioning. Databases from then sit at version 0 with
  // any subset of these tables, and columns that were added on open (sessions.pid, triage.tone) may be missing.
  (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      body TEXT NOT NULL
    )`)
    // open_turn: the turn message images join; last_turn: where a stop-hook continuation recap goes;
    // pid: the harness process, so a wake-up waiter can tell when /clear or resume moved it to another session
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      harness TEXT NOT NULL,
      project TEXT,
      cwd TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      open_turn INTEGER,
      last_turn INTEGER,
      pid INTEGER
    )`)
    if (!hasColumn(db, 'sessions', 'pid'))
      db.run('ALTER TABLE sessions ADD COLUMN pid INTEGER')
    // image: stored file name; image_at / image_session: when and where it was captured, looked up once at queue time
    db.run(`CREATE TABLE IF NOT EXISTS feedback (
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
    db.run('CREATE INDEX IF NOT EXISTS feedback_pending ON feedback (session_id) WHERE delivered_at IS NULL')
    db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    // One verdict per recap line (idx) of a message. Databases from before #37 also have
    // advice and draft columns, which are no longer read or written.
    db.run(`CREATE TABLE IF NOT EXISTS triage (
      message_id INTEGER NOT NULL,
      idx INTEGER NOT NULL,
      verdict TEXT NOT NULL,
      tone TEXT,
      PRIMARY KEY (message_id, idx)
    )`)
    // Hide verdicts by normalized text, so repeated ticks skip the model
    db.run('CREATE TABLE IF NOT EXISTS triage_cache (key TEXT PRIMARY KEY, verdict TEXT NOT NULL)')
    // Tones came after the table did; older rows keep a NULL tone, which reads as default
    if (!hasColumn(db, 'triage', 'tone'))
      db.run('ALTER TABLE triage ADD COLUMN tone TEXT')
    // Before #37 a verdict was signal, progress or noise: only signal stays shown
    db.run(`UPDATE triage SET verdict = CASE verdict WHEN 'signal' THEN 'show' ELSE 'hide' END WHERE verdict IN ('signal', 'progress', 'noise')`)
    db.run(`UPDATE triage_cache SET verdict = 'hide' WHERE verdict IN ('progress', 'noise')`)
  },
]

export const SCHEMA_VERSION = MIGRATIONS.length

/** Applies every migration past the database's user_version, each with its version bump in one transaction */
export function migrate(db: Database): void {
  const { user_version: current } = db.query('PRAGMA user_version').get() as { user_version: number }
  for (let version = current + 1; version <= SCHEMA_VERSION; version++) {
    db.transaction(() => {
      MIGRATIONS[version - 1]!(db)
      // PRAGMA takes no bound parameters; version is a loop integer
      db.run(`PRAGMA user_version = ${version}`)
    })()
  }
}
