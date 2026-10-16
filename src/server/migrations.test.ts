import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { SCHEMA_VERSION } from './migrations'
import { Store } from './store'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gollabara-migrations-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const open = () => new Database(join(dir, 'stream.db'))
/** Opening the store is what migrates */
const openStore = () => new Store(dir)
const version = (db: Database) => (db.query('PRAGMA user_version').get() as { user_version: number }).user_version
const columns = (db: Database, table: string) => (db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
const count = (db: Database, table: string) => (db.query(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n

/** A database from before versioning (user_version 0); `later` adds the columns that were added on open */
function v0(later: boolean): void {
  const db = open()
  db.run('CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, body TEXT NOT NULL)')
  db.run(`CREATE TABLE sessions (id TEXT PRIMARY KEY, name TEXT NOT NULL, harness TEXT NOT NULL, project TEXT, cwd TEXT NOT NULL,
    started_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, open_turn INTEGER, last_turn INTEGER)`)
  db.run(`CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, text TEXT NOT NULL, image TEXT,
    image_at INTEGER, image_session TEXT, created_at INTEGER NOT NULL, delivered_at INTEGER, delivered_via TEXT)`)
  db.run('CREATE INDEX feedback_pending ON feedback (session_id) WHERE delivered_at IS NULL')
  db.run('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  db.run('CREATE TABLE triage (message_id INTEGER NOT NULL, idx INTEGER NOT NULL, verdict TEXT NOT NULL, advice TEXT, draft TEXT, PRIMARY KEY (message_id, idx))')
  db.run('CREATE TABLE triage_cache (key TEXT PRIMARY KEY, verdict TEXT NOT NULL)')
  if (later) {
    db.run('ALTER TABLE sessions ADD COLUMN pid INTEGER')
    db.run('ALTER TABLE triage ADD COLUMN tone TEXT')
  }
  const body = JSON.stringify({ id: 1, at: 1000, session: { id: 'a', name: 'piuda', harness: 'claude-code', cwd: '/a' }, recaps: ['done'] })
  db.run('INSERT INTO messages (at, body) VALUES (?, ?)', [1000, body])
  db.run(`INSERT INTO sessions VALUES ('a', 'piuda', 'claude-code', NULL, '/a', 900, 1000, NULL, 1${later ? ', 4242' : ''})`)
  db.run(`INSERT INTO feedback (session_id, text, created_at) VALUES ('a', '버튼 색 바꿔 줘', 1100)`)
  db.run(`INSERT INTO settings VALUES ('triage', 'claude')`)
  db.run(`INSERT INTO triage (message_id, idx, verdict) VALUES (1, 0, 'signal'), (1, 1, 'noise')`)
  if (later)
    db.run(`UPDATE triage SET tone = 'warning' WHERE idx = 0`)
  db.run(`INSERT INTO triage_cache VALUES ('# 분 경과', 'progress')`)
  db.close()
}

describe('migrations', () => {
  test('a fresh database lands on the latest version with every table', () => {
    openStore()
    const db = open()
    expect(version(db)).toBe(SCHEMA_VERSION)
    expect(columns(db, 'sessions')).toContain('pid')
    expect(columns(db, 'triage')).toContain('tone')
    for (const table of ['messages', 'sessions', 'feedback', 'settings', 'triage', 'triage_cache', 'hook_versions'])
      expect(count(db, table)).toBe(0)
    db.close()
  })

  for (const later of [true, false]) {
    test(`a v0 database ${later ? 'with' : 'without'} the columns added on open upgrades and keeps its data`, () => {
      v0(later)
      const store = openStore()
      expect(store.recent().map(m => m.id)).toEqual([1])
      expect(store.settings()).toEqual({ triage: 'claude' })
      expect(store.triageFor([1])).toEqual([
        { messageId: 1, index: 0, verdict: 'show', ...(later ? { tone: 'warning' } : {}) },
        { messageId: 1, index: 1, verdict: 'hide' },
      ])
      expect(store.cachedVerdict('# 분 경과')).toBe('hide')
      expect(store.claimFeedback('a', 'stop').map(f => f.text)).toEqual(['버튼 색 바꿔 줘'])

      const db = open()
      expect(version(db)).toBe(SCHEMA_VERSION)
      expect(columns(db, 'sessions')).toContain('pid')
      expect(columns(db, 'triage')).toContain('tone')
      expect(db.query('SELECT pid FROM sessions').get()).toEqual({ pid: later ? 4242 : null })
      db.close()
    })
  }

  test('migration 7 ends the sessions that have no pid at their last activity, and only those', () => {
    openStore()
    const db = open()
    db.run('PRAGMA user_version = 6')
    const insert = db.prepare(`INSERT INTO sessions (id, name, harness, cwd, started_at, last_seen_at, pid, ended_at)
      VALUES (?, ?, 'claude-code', '/a', 100, ?, ?, ?)`)
    insert.run('stale', 'piuda', 500, null, null)
    insert.run('live', 'api', 600, 4242, null)
    insert.run('ended', 'od', 700, null, 650)
    db.close()
    const store = openStore()
    expect(store.session('stale')?.endedAt).toBe(500)
    expect(store.session('live')).not.toHaveProperty('endedAt')
    expect(store.session('ended')?.endedAt).toBe(650)
    // A session that was in fact still running comes back with its next event
    const back = store.ingest({ kind: 'recap', session: { id: 'stale', name: 'piuda', harness: 'claude-code', cwd: '/a' }, text: 'still here' }, 800)
    expect(back.session).not.toHaveProperty('endedAt')
    const after = open()
    expect(version(after)).toBe(SCHEMA_VERSION)
    after.close()
  })

  test('reopening an upgraded database runs nothing again', () => {
    openStore()
    const db = open()
    // A row migration 1 would rewrite proves it does not run twice
    db.run(`INSERT INTO triage_cache (key, verdict) VALUES ('k', 'noise')`)
    db.close()
    openStore()
    const after = open()
    expect(version(after)).toBe(SCHEMA_VERSION)
    expect(after.query('SELECT verdict FROM triage_cache').get()).toEqual({ verdict: 'noise' })
    after.close()
  })
})
