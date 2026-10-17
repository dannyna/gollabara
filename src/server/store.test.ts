import type { IncomingEvent, SessionInfo } from '../shared/types'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { FeedbackError, Store, TURN_IDLE_MS } from './store'

// 1×1 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAA'
// The same pixel with its IEND chunk, so it decodes for a dHash
const FULL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
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

  test('a wake-up and a hook share the claim, so an item goes out once', () => {
    store.queueFeedback('cc-1', 'darker header', undefined, 1000)
    expect(store.claimFeedback('cc-1', 'rewake', 2000).map(f => f.deliveredVia)).toEqual(['rewake'])
    expect(store.claimFeedback('cc-1', 'post-tool-use', 2001)).toEqual([])
  })

  test('the latest SessionStart from a process owns its pid (/clear starts a new session in the same process)', () => {
    expect(store.sessionForPid(4242)).toBeNull()
    store.ingest({ kind: 'session', session: cc, pid: 4242 }, 600)
    expect(store.sessionForPid(4242)).toBe('cc-1')
    // Other events from the same process leave it as it is
    store.ingest({ ...image(cc), pid: 4242 }, 700)
    expect(store.sessionForPid(4242)).toBe('cc-1')
    const cleared: SessionInfo = { ...cc, id: 'cc-2' }
    store.ingest({ kind: 'session', session: cleared, pid: 4242 }, 800)
    expect(store.sessionForPid(4242)).toBe('cc-2')
    expect(store.session('cc-1')).not.toHaveProperty('pid')
  })

  test('a compaction keeps the session\'s pid link', () => {
    store.ingest({ kind: 'session', session: cc, pid: 4242, reason: 'startup' }, 600)
    store.ingest({ kind: 'session', session: cc, pid: 4242, reason: 'compact' }, 700)
    expect(store.sessionForPid(4242)).toBe('cc-1')
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

describe('image source', () => {
  test('keeps the source and a dHash for a named image, neither for an unnamed one', () => {
    store.ingest({ kind: 'image', session: od, toolName: 'Read', images: [{ data: FULL_PNG, mime: 'image/png', source: '/tmp/shot.png' }] }, 1000)
    store.ingest(image(), 2000)
    const [named, unnamed] = store.recent()[0]!.images!
    expect(named).toMatchObject({ source: '/tmp/shot.png', dhash: expect.stringMatching(/^[0-9a-f]{16}$/) })
    expect(unnamed).not.toHaveProperty('source')
    expect(unnamed).not.toHaveProperty('dhash')
  })

  test('a message stored before sources existed still loads, and new images join its turn', () => {
    // Same body shape an older server wrote: no source, no dhash
    store.ingest(image(), 1000)
    const reopened = new Store(dir)
    reopened.ingest({ kind: 'image', session: od, toolName: 'Read', images: [{ data: PNG, mime: 'image/png', source: '/tmp/a.png' }] }, 2000)
    expect(reopened.recent()[0]!.images).toEqual([
      { url: expect.any(String), width: 800, height: 500, at: 1000 },
      expect.objectContaining({ source: '/tmp/a.png', at: 2000 }),
    ])
  })

  test('stores each image\'s role as the hook sent it, and none when it sent none', () => {
    store.ingest({ kind: 'image', session: od, toolName: 'Read', images: [
      { data: FULL_PNG, mime: 'image/png', source: '/tmp/mock.png', role: 'reference' },
      { data: PNG, mime: 'image/png', width: 800, height: 500, role: 'artifact' },
    ] }, 1000)
    store.ingest(image(), 2000)
    const [reference, artifact, legacy] = new Store(dir).recent()[0]!.images!
    expect(reference).toMatchObject({ source: '/tmp/mock.png', role: 'reference' })
    expect(artifact).toMatchObject({ role: 'artifact' })
    expect(legacy).not.toHaveProperty('role')
  })
})

describe('deleting', () => {
  const cc: SessionInfo = { id: 'cc-1', name: 'piuda', harness: 'claude-code', cwd: '/a/piuda' }
  const shot = (session: SessionInfo, data: string): IncomingEvent => ({ kind: 'image', session, toolName: 'Read', images: [{ data, mime: 'image/png', width: 1, height: 1 }] })
  const file = (url: string) => join(dir, 'images', url.slice('/img/'.length))
  // Stop closes the turn, so each capture below is its own message
  const capture = (session: SessionInfo, data: string, at: number) => {
    const { message } = store.ingest(shot(session, data), at)
    store.ingest({ kind: 'recap', session, text: 'done' }, at)
    return message!
  }

  /** Ends a session at `at`, as its SessionEnd hook would */
  const end = (session: SessionInfo, at: number) => store.ingest({ kind: 'session-end', session }, at)

  test('expiry removes a session that ended before the cutoff with its messages, feedback, triage and unshared images', () => {
    const lone = capture(od, PNG, 1000)
    const shared = capture(od, FULL_PNG, 1000)
    store.saveTriage({ messageId: lone.id, index: 0, verdict: 'hide' })
    const oldFeedback = store.queueFeedback('od-1', 'old', undefined, 1000)
    end(od, 2000)
    // A running session shares the image; it stays however old its rows are
    const running = capture(cc, FULL_PNG, 500)
    const runningFeedback = store.queueFeedback('cc-1', 'kept', undefined, 500)

    const purged = store.expire(3000, 0)
    expect(purged).toEqual({ messageIds: [lone.id, shared.id], feedbackIds: [oldFeedback.id], sessionIds: ['od-1'], files: [lone.images![0]!.url.slice('/img/'.length)] })
    expect(existsSync(file(lone.images![0]!.url))).toBe(false)
    expect(existsSync(file(running.images![0]!.url))).toBe(true)
    expect(store.recent().map(m => m.id)).toEqual([running.id])
    expect(store.recentFeedback().map(f => f.id)).toEqual([runningFeedback.id])
    expect(store.triageFor([lone.id])).toEqual([])
    expect(store.sessions().map(s => s.id)).toEqual(['cc-1'])
  })

  test('expiry keeps a session that ended after the cutoff, or ended and came back', () => {
    const recent = capture(od, PNG, 1000)
    end(od, 4000)
    const back = capture(cc, FULL_PNG, 1000)
    end(cc, 1500)
    // Any later event clears ended_at
    const resumed = store.ingest({ kind: 'recap', session: cc, text: 'resumed' }, 1600).message!
    expect(store.expire(3000, 0)).toEqual({ messageIds: [], feedbackIds: [], sessionIds: [], files: [] })
    expect(store.recent().map(m => m.id)).toEqual([recent.id, back.id, resumed.id])
    expect(store.sessions().map(s => s.id).sort()).toEqual(['cc-1', 'od-1'])
  })

  test('expiry removes rows older than the cutoff whose session has no record left', () => {
    const old = capture(od, PNG, 1000)
    const newer = capture(od, FULL_PNG, 5000)
    const oldFeedback = store.queueFeedback('od-1', 'old', undefined, 1000)
    store.queueFeedback('od-1', 'newer', undefined, 5000)
    // Rows from before expiry outlived their session record
    const db = new Database(join(dir, 'stream.db'))
    db.run(`DELETE FROM sessions WHERE id = 'od-1'`)
    // An early body named its session only as an object
    const early = db.query('INSERT INTO messages (at, body) VALUES (1000, ?) RETURNING id').get(JSON.stringify({ session: { id: 'gone' }, recaps: ['done'] })) as { id: number }
    db.close()
    const purged = store.expire(3000, 0)
    expect(purged).toMatchObject({ messageIds: [old.id, early.id], feedbackIds: [oldFeedback.id], sessionIds: [] })
    expect(store.recent().map(m => m.id)).toEqual([newer.id])
  })

  test('expiry drops cached hide verdicts not written or used since the cache cutoff', () => {
    store.cacheVerdict('old', 'hide', 1000)
    store.cacheVerdict('reused', 'hide', 1000)
    store.cachedVerdict('reused', 4000)
    store.cacheVerdict('new', 'hide', 5000)
    store.expire(0, 3000)
    expect(['old', 'reused', 'new'].map(k => store.cachedVerdict(k))).toEqual([null, 'hide', 'hide'])
  })

  test('discarding removes only queued feedback, and images nothing else uses', () => {
    const shot = capture(od, PNG, 1000)
    store.ingest({ kind: 'session', session: cc }, 2000)
    const delivered = store.queueFeedback('cc-1', 'sent', undefined, 2000)
    store.claimFeedback('cc-1', 'stop', 2100)
    const quoting = store.queueFeedback('cc-1', 'about this', shot.images![0]!.url, 2200)
    const queued = store.queueFeedback('cc-1', 'later', undefined, 2300)
    // The capture's own message goes; the queued item still quotes the file
    store.deleteSession('od-1')
    expect(existsSync(file(shot.images![0]!.url))).toBe(true)

    expect(store.discardFeedback('cc-1', [quoting.id, delivered.id])).toEqual({ messageIds: [], feedbackIds: [quoting.id], sessionIds: [], files: [shot.images![0]!.url.slice('/img/'.length)] })
    expect(existsSync(file(shot.images![0]!.url))).toBe(false)
    expect(store.discardFeedback('cc-1').feedbackIds).toEqual([queued.id])
    expect(store.recentFeedback().map(f => f.id)).toEqual([delivered.id])
  })

  test('a file that remaining feedback quotes stays', () => {
    const old = capture(od, PNG, 1000)
    end(od, 1000)
    store.ingest({ kind: 'session', session: cc }, 5000)
    store.queueFeedback('cc-1', 'look at this', old.images![0]!.url, 5000)
    expect(store.expire(3000, 0).files).toEqual([])
    expect(existsSync(file(old.images![0]!.url))).toBe(true)
  })

  test('deleting a session removes its messages, feedback, triage and unshared images', () => {
    const own = capture(od, PNG, 1000)
    const shared = capture(od, FULL_PNG, 1100)
    store.saveTriage({ messageId: own.id, index: 0, verdict: 'show' })
    const feedback = store.queueFeedback('od-1', 'bigger', own.images![0]!.url, 1200)
    const other = capture(cc, FULL_PNG, 1300)
    const kept = store.queueFeedback('cc-1', 'kept', undefined, 1400)

    const purged = store.deleteSession('od-1')
    expect(purged).toEqual({ messageIds: [own.id, shared.id], feedbackIds: [feedback.id], sessionIds: ['od-1'], files: [own.images![0]!.url.slice('/img/'.length)] })
    expect(existsSync(file(own.images![0]!.url))).toBe(false)
    expect(existsSync(file(other.images![0]!.url))).toBe(true)
    expect(store.recent().map(m => m.id)).toEqual([other.id])
    expect(store.recentFeedback().map(f => f.id)).toEqual([kept.id])
    expect(store.triageFor([own.id])).toEqual([])
    expect(store.session('od-1')).toBeNull()
  })
})

describe('settings', () => {
  test('a patch changes only its keys; a seed writes only keys never saved', () => {
    expect(store.settings()).toEqual({ triage: 'off' })
    expect(store.saveSettings({ phone: 'https://mac.ts.net' })).toEqual({ triage: 'off', phone: 'https://mac.ts.net' })
    expect(store.saveSettings({ triage: 'claude', phone: 'https://other.ts.net' }, true)).toEqual({ triage: 'claude', phone: 'https://mac.ts.net' })
    expect(store.saveSettings({ phone: '' })).toEqual({ triage: 'claude', phone: '' })
    expect(store.saveSettings({ answer: 'on' })).toEqual({ triage: 'claude', phone: '', answer: 'on' })
  })
})

describe('answers', () => {
  const cc: SessionInfo = { id: 'cc-1', name: 'piuda', harness: 'claude-code', cwd: '/a/piuda' }
  const questions = [{ question: 'Which?', options: [{ label: 'A' }, { label: 'B' }] }]

  test('a question keeps its call id, and the first answer recorded wins', () => {
    const asked = store.ingest({ kind: 'question', session: cc, questions, id: 'toolu_1' }, 100).message!
    expect(asked.questionId).toBe('toolu_1')
    const app = store.recordAnswer('cc-1', 'toolu_1', { 'Which?': 'B' }, 'app', 200)
    expect(app).toMatchObject({ id: asked.id, answer: { answers: { 'Which?': 'B' }, via: 'app', at: 200 } })
    // The PostToolUse after the app's answer reports the same answer; the app's record stays
    expect(store.ingest({ kind: 'answer', session: cc, questionId: 'toolu_1', answers: { 'Which?': 'B' } }, 300).message).toBeNull()
    expect(store.get(asked.id)!.answer).toEqual({ answers: { 'Which?': 'B' }, via: 'app', at: 200 })
  })

  test('a terminal answer lands on its question; one for an unknown question changes nothing', () => {
    const asked = store.ingest({ kind: 'question', session: cc, questions, id: 'toolu_2' }, 100).message!
    const { message, created } = store.ingest({ kind: 'answer', session: cc, questionId: 'toolu_2', answers: { 'Which?': 'A' } }, 150)
    expect({ id: message?.id, created, answer: message?.answer }).toEqual({ id: asked.id, created: false, answer: { answers: { 'Which?': 'A' }, via: 'terminal', at: 150 } })
    expect(store.ingest({ kind: 'answer', session: cc, questionId: 'toolu_x', answers: { 'Which?': 'A' } }, 160).message).toBeNull()
    expect(store.recent().find(m => m.id === asked.id)?.answer?.via).toBe('terminal')
  })
})

describe('ended sessions', () => {
  const cc: SessionInfo = { id: 'cc-1', name: 'piuda', harness: 'claude-code', cwd: '/a/piuda' }

  test('a session end marks the session, drops its pid, and refuses feedback with 409; any later event brings it back', () => {
    store.ingest({ kind: 'session', session: cc, pid: 4242 }, 500)
    const { session, message } = store.ingest({ kind: 'session-end', session: cc }, 900)
    expect(message).toBeNull()
    expect(session).toMatchObject({ endedAt: 900, lastSeenAt: 900 })
    expect(store.sessionForPid(4242)).toBeNull()
    const refused = (() => {
      try {
        store.queueFeedback('cc-1', 'too late', undefined, 1000)
      }
      catch (error) {
        return error
      }
    })()
    expect(refused).toBeInstanceOf(FeedbackError)
    expect(refused).toMatchObject({ status: 409, message: 'session ended' })
    // A resume, or any event at all, means it runs again
    expect(store.ingest({ kind: 'session', session: cc, reason: 'resume' }, 2000).session).not.toHaveProperty('endedAt')
    expect(store.queueFeedback('cc-1', 'welcome back', undefined, 2100).text).toBe('welcome back')
    store.ingest({ kind: 'session-end', session: cc }, 3000)
    expect(store.ingest({ kind: 'recap', session: cc, text: 'late recap' }, 3100).session).not.toHaveProperty('endedAt')
  })

  test('a session end closes the open turn, so a resumed session starts a new one', () => {
    const first = store.ingest(image(cc), 500).message!
    store.ingest({ kind: 'session-end', session: cc }, 600)
    expect(store.ingest(image(cc), 700).message!.id).not.toBe(first.id)
  })

  test('feedback queued before the end stays queued, so a resume still gets it', () => {
    store.ingest({ kind: 'session', session: cc }, 500)
    store.queueFeedback('cc-1', 'queued', undefined, 600)
    store.ingest({ kind: 'session-end', session: cc }, 700)
    expect(store.recentFeedback()[0]).not.toHaveProperty('deliveredAt')
    store.ingest({ kind: 'session', session: cc, reason: 'resume' }, 800)
    expect(store.claimFeedback('cc-1', 'user-prompt-submit', 900).map(f => f.text)).toEqual(['queued'])
  })

  test('only running sessions with a pid are checked; ending one twice keeps the first time', () => {
    store.ingest({ kind: 'session', session: cc, pid: 4242 }, 500)
    store.ingest({ kind: 'session', session: od }, 500)
    expect(store.pidLinks()).toEqual([{ id: 'cc-1', pid: 4242, at: 500 }])
    expect(store.endSessions(['cc-1', 'od-1'], 900).map(s => [s.id, s.endedAt])).toEqual([['cc-1', 900], ['od-1', 900]])
    expect(store.pidLinks()).toEqual([])
    expect(store.sessionForPid(4242)).toBeNull()
    expect(store.endSessions(['cc-1'], 1000)).toEqual([])
    expect(store.session('cc-1')?.endedAt).toBe(900)
  })

  test('a session whose pid another session took ended with it (/clear, or a reused pid)', () => {
    store.ingest({ kind: 'session', session: cc, pid: 4242 }, 500)
    store.ingest({ kind: 'session', session: { ...cc, id: 'cc-2' }, pid: 4242, reason: 'clear' }, 800)
    expect(store.session('cc-1')?.endedAt).toBe(800)
    expect(store.session('cc-2')).not.toHaveProperty('endedAt')
    expect(store.pidLinks()).toEqual([{ id: 'cc-2', pid: 4242, at: 800 }])
  })

  test('any event links a session whose SessionStart was lost', () => {
    store.ingest({ kind: 'recap', session: cc, text: 'done', pid: 4242 }, 500)
    expect(store.pidLinks()).toEqual([{ id: 'cc-1', pid: 4242, at: 500 }])
    store.ingest({ kind: 'question', session: od, questions: [], pid: 5151 }, 600)
    store.ingest({ ...image(od), pid: 5151 }, 700)
    expect(store.pidLinks()).toContainEqual({ id: 'od-1', pid: 5151, at: 600 })
  })

  test('a late link takes the pid from the session that held it (a /clear whose SessionStart was lost)', () => {
    store.ingest({ kind: 'session', session: cc, pid: 4242 }, 500)
    store.ingest({ kind: 'recap', session: { ...cc, id: 'cc-2' }, text: 'after clear', pid: 4242 }, 800)
    expect(store.session('cc-1')).toMatchObject({ endedAt: 800 })
    expect(store.sessionForPid(4242)).toBe('cc-2')
    expect(store.pidLinks()).toEqual([{ id: 'cc-2', pid: 4242, at: 800 }])
  })

  test('an event from the linked process keeps the link\'s time, so the pid-reuse check still holds', () => {
    store.ingest({ kind: 'session', session: cc, pid: 4242 }, 500)
    store.ingest({ kind: 'recap', session: cc, text: 'done', pid: 4242 }, 900)
    expect(store.pidLinks()).toEqual([{ id: 'cc-1', pid: 4242, at: 500 }])
  })

  test('a session end with a pid still drops the link', () => {
    store.ingest({ kind: 'recap', session: cc, text: 'done', pid: 4242 }, 500)
    store.ingest({ kind: 'session-end', session: cc, pid: 4242 }, 900)
    expect(store.sessionForPid(4242)).toBeNull()
    expect(store.pidLinks()).toEqual([])
  })

  test('an event without a pid (an older hook) leaves the link as it is', () => {
    store.ingest({ kind: 'recap', session: cc, text: 'done' }, 500)
    expect(store.pidLinks()).toEqual([])
    store.ingest({ kind: 'session', session: cc, pid: 4242 }, 600)
    store.ingest({ kind: 'recap', session: cc, text: 'again' }, 700)
    expect(store.pidLinks()).toEqual([{ id: 'cc-1', pid: 4242, at: 600 }])
  })
})

describe('history', () => {
  /** One recap per call, each its own message, oldest first as the hook would store them */
  const say = (session: SessionInfo, text: string, at: number) => store.ingest({ kind: 'recap', session, text }, at).message!

  test('pages extend a run back with no gap, and say whether more lies before it', () => {
    const ids = [1, 2, 3, 4, 5].map(n => say(od, `line ${n}`, n * 1000).id)
    const latest = store.history(undefined, 2)
    expect(latest.messages.map(m => m.id)).toEqual(ids.slice(3))
    expect(latest.older).toBe(true)
    const older = store.history(ids[3]!, 2)
    expect(older.messages.map(m => m.id)).toEqual(ids.slice(1, 3))
    expect(older.older).toBe(true)
    expect(store.history(ids[1]!, 2)).toMatchObject({ older: false })
    expect(store.history(ids[0]!, 2)).toEqual({ messages: [], triage: [], feedback: [], older: false })
  })

  test('a page carries its verdicts and the feedback sent in its span, so pages laid end to end hold each once', () => {
    const first = say(od, 'first', 1000)
    store.queueFeedback('od-1', 'before the second', undefined, 1500)
    const second = say(od, 'second', 2000)
    store.queueFeedback('od-1', 'after the second', undefined, 2500)
    store.saveTriage({ messageId: first.id, index: 0, verdict: 'hide' })
    const older = store.history(second.id, 10)
    expect(older.triage).toEqual([{ messageId: first.id, index: 0, verdict: 'hide' }])
    expect(older.feedback.map(f => f.text)).toEqual(['before the second'])
    expect(store.history(undefined, 1).feedback.map(f => f.text)).toEqual(['after the second'])
  })

  test('a session\'s messages are found through the expression index', () => {
    const db = new Database(join(dir, 'stream.db'))
    const plan = (sql: string) => (db.query(`EXPLAIN QUERY PLAN ${sql}`).all() as { detail: string }[]).map(r => r.detail).join('; ')
    expect(plan(`SELECT at FROM messages WHERE json_extract(body, '$.sessionId') = 'x'`)).toContain('INDEX messages_session')
    db.close()
  })
})
