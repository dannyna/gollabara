import type { IncomingEvent, SessionInfo } from '../shared/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { FeedbackError, Store, TURN_IDLE_MS } from './store'

// 1×1 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAA'
const od: SessionInfo = { id: 'od-1', name: 'gollabara-spike', harness: 'open-design', project: 'gollabara-spike', cwd: '/od/data' }

const image = (session = od): IncomingEvent => ({ kind: 'image', session, toolName: 'Read', images: [{ data: PNG, mime: 'image/png', width: 800, height: 500 }] })
const recap = (text: string, continuation?: boolean): IncomingEvent => ({ kind: 'recap', session: od, text, ...(continuation ? { continuation } : {}) })

let dir: string
let store: Store
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gollabara-store-'))
  store = new Store(dir)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('sessions', () => {
  test('SessionStart stores a session; a resume keeps startedAt and moves lastSeenAt', () => {
    expect(store.ingest({ kind: 'session', session: od }, 1000)).toMatchObject({ message: null })
    const { session } = store.ingest({ kind: 'session', session: od }, 5000)
    expect(session).toEqual({ ...od, startedAt: 1000, lastSeenAt: 5000 })
    expect(store.sessions()).toEqual([session])
  })

  test('an event without a prior SessionStart creates the session', () => {
    const { session } = store.ingest(image(), 2000)
    expect(session).toMatchObject({ id: 'od-1', harness: 'open-design', startedAt: 2000, lastSeenAt: 2000 })
  })

  test('events from older hooks without a harness count as claude-code', () => {
    const legacy = { id: 'cc-1', name: 'piuda', cwd: '/a/piuda' } as SessionInfo
    expect(store.ingest({ kind: 'session', session: legacy }, 1).session.harness).toBe('claude-code')
  })
})

describe('turn grouping', () => {
  test('two images then Stop make one message with both images and the recap', () => {
    const first = store.ingest(image(), 1000)
    const second = store.ingest(image(), 2000)
    const stop = store.ingest(recap('Built index.html'), 3000)
    expect(first.created).toBe(true)
    expect([second.created, stop.created]).toEqual([false, false])
    expect(store.recent()).toHaveLength(1)
    expect(store.recent()[0]).toMatchObject({ id: first.message!.id, kind: 'turn', at: 1000, recaps: ['Built index.html'], text: 'Built index.html' })
    expect(store.recent()[0]!.images!.map(i => i.at)).toEqual([1000, 2000])
  })

  test('a stop-hook continuation adds a second recap to the same message', () => {
    store.ingest(image(), 1000)
    store.ingest(recap('first'), 2000)
    const cont = store.ingest(recap('second', true), 3000)
    expect(cont.created).toBe(false)
    expect(store.recent()).toEqual([expect.objectContaining({ recaps: ['first', 'second'] })])
  })

  test('the next image after Stop starts a new message', () => {
    store.ingest(image(), 1000)
    store.ingest(recap('done'), 2000)
    expect(store.ingest(image(), 3000).created).toBe(true)
    expect(store.recent()).toHaveLength(2)
  })

  test('Stop with no open turn makes a recap-only message', () => {
    const { message, created } = store.ingest(recap('just talked'), 1000)
    expect(created).toBe(true)
    expect(message).toMatchObject({ kind: 'turn', recaps: ['just talked'] })
    expect(message!.images).toBeUndefined()
  })

  test('an image after 10+ minutes idle starts a new message', () => {
    store.ingest(image(), 1000)
    store.ingest(image(), 1000 + TURN_IDLE_MS)
    store.ingest(image(), 1000 + 2 * TURN_IDLE_MS + 1)
    expect(store.recent().map(m => m.images!.length)).toEqual([2, 1])
  })

  test('a question in the middle is its own message and the turn continues', () => {
    const turn = store.ingest(image(), 1000)
    const question = store.ingest({ kind: 'question', session: od, questions: [{ question: 'A or B?', options: [{ label: 'A' }] }] }, 2000)
    const after = store.ingest(image(), 3000)
    store.ingest(recap('done'), 4000)
    expect(question.created).toBe(true)
    expect(after.message!.id).toBe(turn.message!.id)
    expect(store.recent().map(m => m.kind)).toEqual(['turn', 'question'])
    expect(store.recent()[0]).toMatchObject({ recaps: ['done'] })
    expect(store.recent()[0]!.images).toHaveLength(2)
  })

  test('turns are per session', () => {
    const other: SessionInfo = { id: 'cc-1', name: 'piuda', harness: 'claude-code', cwd: '/a/piuda' }
    store.ingest(image(), 1000)
    store.ingest(image(other), 2000)
    store.ingest(image(), 3000)
    expect(store.recent().map(m => [m.sessionId, m.images!.length])).toEqual([['od-1', 2], ['cc-1', 1]])
  })
})

describe('feedback', () => {
  const cc: SessionInfo = { id: 'cc-1', name: 'piuda', harness: 'claude-code', cwd: '/a/piuda' }
  beforeEach(() => {
    store.ingest({ kind: 'session', session: od }, 500)
    store.ingest({ kind: 'session', session: cc }, 500)
  })

  test('queued feedback is claimed once, in order, with the hook point recorded', () => {
    const first = store.queueFeedback('od-1', 'darker header', undefined, 1000)
    store.queueFeedback('od-1', 'and a bigger title', undefined, 1100)
    expect(first).toEqual({ id: first.id, sessionId: 'od-1', text: 'darker header', createdAt: 1000 })
    const claimed = store.claimFeedback('od-1', 'post-tool-use', 2000)
    expect(claimed.map(f => [f.text, f.deliveredAt, f.deliveredVia])).toEqual([
      ['darker header', 2000, 'post-tool-use'],
      ['and a bigger title', 2000, 'post-tool-use'],
    ])
    expect(store.claimFeedback('od-1', 'stop', 3000)).toEqual([])
    expect(store.recentFeedback()).toEqual(claimed)
  })

  test('a claim leaves other sessions\' feedback queued', () => {
    store.queueFeedback('od-1', 'for od', undefined, 1000)
    store.queueFeedback('cc-1', 'for cc', undefined, 1000)
    expect(store.claimFeedback('od-1', 'stop', 2000).map(f => f.text)).toEqual(['for od'])
    expect(store.recentFeedback().find(f => f.sessionId === 'cc-1')).not.toHaveProperty('deliveredAt')
    expect(store.claimFeedback('cc-1', 'user-prompt-submit', 3000).map(f => f.text)).toEqual(['for cc'])
  })

  test('image feedback resolves to the stored file, its capture time and session', () => {
    const { message } = store.ingest(image(), 1500)
    const url = message!.images![0]!.url
    const feedback = store.queueFeedback('cc-1', 'cut off', url, 2000)
    expect(feedback.image).toEqual({ url, path: join(dir, 'images', url.slice('/img/'.length)), at: 1500, sessionName: 'gollabara-spike' })
    expect(store.queueFeedback('cc-1', 'bare name works too', url.slice('/img/'.length), 2100).image).toEqual(feedback.image)
  })

  test('an unknown session or image, or a path outside the image directory, is refused', () => {
    expect(() => store.queueFeedback('nope', 'hi')).toThrow(FeedbackError)
    for (const ref of ['/img/missing.png', '../stream.db', '/img/..'])
      expect(() => store.queueFeedback('od-1', 'hi', ref)).toThrow('unknown image')
  })
})
