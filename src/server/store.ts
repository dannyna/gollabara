// 메시지는 SQLite, 이미지는 내용 해시 이름의 파일로 저장한다. 서드파티 스토리지 없음.
import { Database } from 'bun:sqlite'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'
import type { IncomingEvent, StoredImage, StreamMessage } from '../shared/types'
import { imageSize } from './image-size'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

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
  }

  /** 이벤트를 메시지로 저장한다. 화면에 흘릴 것이 없으면 null */
  add(event: IncomingEvent): StreamMessage | null {
    if (event.kind === 'session')
      return null
    const base = { at: Date.now(), sessionId: event.session.id, sessionName: event.session.name }
    let draft: Omit<StreamMessage, 'id'>
    if (event.kind === 'image')
      draft = { ...base, kind: 'image', toolName: event.toolName, images: event.images.map(i => this.saveImage(i.data, i.mime, i.width, i.height)) }
    else if (event.kind === 'recap')
      draft = { ...base, kind: 'recap', text: event.text }
    else
      draft = { ...base, kind: 'question', questions: event.questions }
    const row = this.db.query('INSERT INTO messages (at, body) VALUES (?, ?) RETURNING id').get(draft.at, JSON.stringify(draft)) as { id: number }
    return { id: row.id, ...draft }
  }

  recent(limit = 300): StreamMessage[] {
    const rows = this.db.query('SELECT id, body FROM messages ORDER BY id DESC LIMIT ?').all(limit) as { id: number, body: string }[]
    return rows.reverse().map(r => ({ id: r.id, ...JSON.parse(r.body) }))
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
