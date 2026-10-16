import type { Server } from 'bun'
import type { Feedback, HistoryPage, Session } from '../shared/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { startServer } from '.'

const ENV = ['GOLLABARA_DATA', 'GOLLABARA_PORT', 'GOLLABARA_HOST'] as const
const saved = Object.fromEntries(ENV.map(k => [k, process.env[k]]))
const data = mkdtempSync(join(tmpdir(), 'gollabara-routes-'))
let servers: Server<undefined>[]
let url: string

// A real server on a free loopback port and a scratch data dir; never the one on 4747
beforeAll(() => {
  Object.assign(process.env, { GOLLABARA_DATA: data, GOLLABARA_PORT: '0', GOLLABARA_HOST: '127.0.0.1' })
  servers = startServer()
  url = servers[0]!.url.href.replace(/\/$/, '')
})
afterAll(() => {
  for (const server of servers) server.stop(true)
  for (const key of ENV) {
    if (saved[key] === undefined)
      delete process.env[key]
    else
      process.env[key] = saved[key]
  }
  rmSync(data, { recursive: true, force: true })
})

function start(id: string, harness: string) {
  return fetch(`${url}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'session', session: { id, name: id, harness, cwd: '/a' }, reason: 'startup' }),
  })
}
async function routes(): Promise<Record<string, Session['routes']>> {
  const sessions = await (await fetch(`${url}/api/sessions`)).json() as Session[]
  return Object.fromEntries(sessions.map(s => [s.id, s.routes]))
}

describe('session delivery routes', () => {
  test('Codex has the hook routes; Claude Code adds idle wake only while its waiter polls', async () => {
    await start('cx', 'codex')
    await start('cc', 'claude-code')
    expect(await routes()).toEqual({ cx: ['next-tool', 'next-prompt', 'turn-end'], cc: ['next-tool', 'next-prompt', 'turn-end'] })

    const poll = new AbortController()
    const waiting = fetch(`${url}/api/channel/wait?session=cc&waiter=1`, { signal: poll.signal }).catch(() => null)
    // The poll registers as soon as the server reads the request
    for (let i = 0; i < 50 && !(await routes()).cc?.includes('idle-wake'); i++)
      await Bun.sleep(10)
    expect((await routes()).cc).toEqual(['next-tool', 'next-prompt', 'turn-end', 'idle-wake'])
    expect((await routes()).cx).toEqual(['next-tool', 'next-prompt', 'turn-end'])
    poll.abort()
    await waiting
  })
})

const json = { 'content-type': 'application/json' }

describe('session state', () => {
  test('rides on the session list and frames, with a frame only when a claim changes it', async () => {
    const info = { id: 'st', name: 'st', harness: 'claude-code', cwd: '/a' }
    const state = async () => ((await (await fetch(`${url}/api/sessions`)).json() as Session[]).find(s => s.id === 'st'))?.state
    const claim = (via: string) => fetch(`${url}/api/feedback/claim`, { method: 'POST', headers: json, body: JSON.stringify({ sessionId: 'st', via }) })
    await start('st', 'claude-code')
    expect(await state()).toBe('idle')
    const ws = new WebSocket(`${url.replace('http', 'ws')}/ws`)
    const frames: { type: string, session?: Session }[] = []
    ws.onmessage = e => frames.push(JSON.parse(e.data as string))
    await new Promise(resolve => ws.onopen = resolve)
    const states = () => frames.filter(f => f.type === 'session' && f.session?.id === 'st').map(f => f.session!.state)

    await claim('user-prompt-submit')
    await claim('post-tool-use')
    await fetch(`${url}/api/events`, { method: 'POST', headers: json, body: JSON.stringify({ kind: 'question', session: info, questions: [{ question: 'Which?', options: [] }] }) })
    await claim('post-tool-use')
    await claim('stop')
    for (let i = 0; i < 50 && states().length < 4; i++)
      await Bun.sleep(10)
    expect(states()).toEqual(['working', 'waiting', 'working', 'idle'])

    await fetch(`${url}/api/events`, { method: 'POST', headers: json, body: JSON.stringify({ kind: 'session-end', session: info }) })
    expect(await state()).toBeUndefined()
    ws.close()
  })
})

describe('settings', () => {
  test('a PUT changes only the keys it names; a seed never overwrites a stored value', async () => {
    const put = async (body: unknown) => fetch(`${url}/api/settings`, { method: 'PUT', headers: json, body: JSON.stringify(body) })
    expect(await (await put({ phone: 'https://mac.ts.net' })).json()).toEqual({ triage: 'off', phone: 'https://mac.ts.net' })
    expect(await (await put({ phone: 'https://other.ts.net', seed: true })).json()).toEqual({ triage: 'off', phone: 'https://mac.ts.net' })
    expect((await put({ phone: 'http://mac.local' })).status).toBe(400)
    expect(await (await fetch(`${url}/api/settings`)).json()).toEqual({ triage: 'off', phone: 'https://mac.ts.net' })
  })

  test('a stale client\'s retention is accepted and ignored (#116)', async () => {
    const put = async (body: unknown) => fetch(`${url}/api/settings`, { method: 'PUT', headers: json, body: JSON.stringify(body) })
    const res = await put({ retention: '7', seed: true })
    expect(res.status).toBe(200)
    expect(await res.json()).not.toHaveProperty('retention')
    expect((await put({ retention: '1' })).status).toBe(200)
    expect(await (await fetch(`${url}/api/settings`)).json()).not.toHaveProperty('retention')
  })
})

describe('deleting a session', () => {
  test('removes its data and tells every view', async () => {
    await start('gone', 'claude-code')
    await fetch(`${url}/api/events`, { method: 'POST', headers: json, body: JSON.stringify({ kind: 'recap', session: { id: 'gone', name: 'gone', harness: 'claude-code', cwd: '/a' }, text: 'done' }) })
    const ws = new WebSocket(`${url.replace('http', 'ws')}/ws`)
    const frames: { type: string }[] = []
    ws.onmessage = e => frames.push(JSON.parse(e.data as string))
    await new Promise(resolve => ws.onopen = resolve)

    const res = await fetch(`${url}/api/sessions/gone`, { method: 'DELETE', headers: json })
    expect(await res.json()).toMatchObject({ ok: true, messages: 1 })
    for (let i = 0; i < 50 && !frames.some(f => f.type === 'deleted'); i++)
      await Bun.sleep(10)
    expect(frames.find(f => f.type === 'deleted')).toMatchObject({ sessionIds: ['gone'], feedbackIds: [] })
    expect((await routes()).gone).toBeUndefined()
    ws.close()
  })
})

describe('history', () => {
  test('pages answer before their cursor; a bad parameter falls back instead of failing', async () => {
    const say = (text: string) => fetch(`${url}/api/events`, { method: 'POST', headers: json, body: JSON.stringify({ kind: 'recap', session: { id: 'hist', name: 'hist', harness: 'claude-code', cwd: '/a' }, text }) })
    const ids = [] as number[]
    for (const text of ['one', 'two', 'three']) ids.push((await (await say(text)).json() as { id: number }).id)
    const latest = await (await fetch(`${url}/api/history?limit=2`)).json() as HistoryPage
    expect(latest.messages.map(m => m.id)).toEqual(ids.slice(1))
    expect(latest.older).toBe(true)
    const older = await (await fetch(`${url}/api/history?before=${ids[1]}&limit=nope`)).json() as HistoryPage
    expect(older.messages.at(-1)!.id).toBe(ids[0])
    // The day list is gone (#116), and an API path nothing answers is not the app's page
    expect((await fetch(`${url}/api/history/days?tz=540`)).status).toBe(404)
  })
})

describe('ended sessions', () => {
  test('a session end refuses feedback with 409 and drops the routes; the next event brings it back', async () => {
    const post = (path: string, body: unknown) => fetch(`${url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    await start('gone', 'claude-code')
    await post('/api/events', { kind: 'session-end', session: { id: 'gone', name: 'gone', harness: 'claude-code', cwd: '/a' } })
    const listed = (await (await fetch(`${url}/api/sessions`)).json() as Session[]).find(s => s.id === 'gone')
    expect(listed).toMatchObject({ endedAt: expect.any(Number), routes: [] })
    const refused = await post('/api/feedback', { sessionId: 'gone', text: 'hello?' })
    expect([refused.status, await refused.text()]).toEqual([409, 'session ended'])
    // A waiter for it steps aside at once
    const waited = await fetch(`${url}/api/channel/wait?session=gone&waiter=1`)
    expect([waited.status, await waited.text()]).toEqual([410, 'ended'])

    await start('gone', 'claude-code')
    expect((await post('/api/feedback', { sessionId: 'gone', text: 'hello' })).status).toBe(200)
  })
})

describe('quote-reply', () => {
  test('a quote rides with the feedback through the POST, hello, history and the claim', async () => {
    const post = (path: string, body: unknown) => fetch(`${url}${path}`, { method: 'POST', headers: json, body: JSON.stringify(body) })
    await start('qr', 'claude-code')
    const long = `  Sidebar\n state saved. ${'x'.repeat(400)}`
    const res = await post('/api/feedback', { sessionId: 'qr', text: 'run e2e too', quote: { text: long, at: 1234 } })
    const queued = await res.json() as Feedback
    expect(queued.quote!.at).toBe(1234)
    expect(queued.quote!.text).toStartWith('Sidebar state saved. xxx')
    expect(queued.quote!.text).toHaveLength(300)

    const ws = new WebSocket(`${url.replace('http', 'ws')}/ws`)
    const hello = await new Promise<{ feedback: Feedback[] }>(resolve => ws.onmessage = e => resolve(JSON.parse(e.data as string)))
    ws.close()
    expect(hello.feedback.find(f => f.id === queued.id)?.quote).toEqual(queued.quote)
    const page = await (await fetch(`${url}/api/history`)).json() as HistoryPage
    expect(page.feedback.find(f => f.id === queued.id)?.quote).toEqual(queued.quote)
    const claimed = await (await post('/api/feedback/claim', { sessionId: 'qr', via: 'post-tool-use' })).json() as Feedback[]
    expect(claimed.map(f => f.quote)).toEqual([queued.quote])
  })

  test('a malformed quote is refused, and feedback without one has none', async () => {
    const post = (body: unknown) => fetch(`${url}/api/feedback`, { method: 'POST', headers: json, body: JSON.stringify({ sessionId: 'qr', text: 'hi', ...body as object }) })
    await start('qr', 'claude-code')
    for (const quote of [null, 'line', { text: 'line' }, { text: '  ', at: 1 }, { text: 3, at: 1 }, { text: 'line', at: 'noon' }])
      expect((await post({ quote })).status).toBe(400)
    expect(await (await post({})).json()).not.toHaveProperty('quote')
  })
})

describe('answering a question from the app', () => {
  const info = { id: 'ask', name: 'ask', harness: 'claude-code', cwd: '/a' }
  const questions = [{ question: 'Which?', options: [{ label: 'A' }, { label: 'B' }] }]
  const post = (path: string, body: unknown, signal?: AbortSignal) => fetch(`${url}${path}`, { method: 'POST', headers: json, body: JSON.stringify(body), signal })
  const hold = (questionId: string, signal?: AbortSignal) => post('/api/questions/hold', { sessionId: 'ask', questionId, questions }, signal)
  const setAnswer = (answer: string) => fetch(`${url}/api/settings`, { method: 'PUT', headers: json, body: JSON.stringify({ answer }) })
  async function viewer() {
    const ws = new WebSocket(`${url.replace('http', 'ws')}/ws`)
    const frames: { type: string, [key: string]: unknown }[] = []
    ws.onmessage = e => frames.push(JSON.parse(e.data as string))
    await new Promise(resolve => ws.onopen = resolve)
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 100 && !ok(); i++)
        await Bun.sleep(10)
    }
    return { ws, frames, until }
  }

  test('the setting is validated and rides on GET', async () => {
    expect((await setAnswer('maybe')).status).toBe(400)
    expect(await (await setAnswer('off')).json()).toMatchObject({ answer: 'off' })
    expect(await (await fetch(`${url}/api/settings`)).json()).toMatchObject({ answer: 'off' })
  })

  test('no hold with the setting off or no view open', async () => {
    await start('ask', 'claude-code')
    await setAnswer('off')
    const v = await viewer()
    expect(await (await hold('q0')).json()).toEqual({ hold: false })
    v.ws.close()
    await setAnswer('on')
    for (let i = 0; i < 50 && servers[0]!.subscriberCount('stream') > 0; i++)
      await Bun.sleep(10)
    expect(await (await hold('q0')).json()).toEqual({ hold: false })
  })

  test('a held question takes the app\'s answer once; the hook gets it and views see the hold and the answer', async () => {
    await start('ask', 'claude-code')
    await setAnswer('on')
    await post('/api/events', { kind: 'question', session: info, questions, id: 'q1' })
    const v = await viewer()
    const held = hold('q1')
    await v.until(() => v.frames.some(f => f.type === 'hold' && f.until))
    // A view that opens now learns of the hold from its hello
    const late = await viewer()
    await late.until(() => late.frames.length > 0)
    expect(late.frames[0]).toMatchObject({ type: 'hello', holds: [{ sessionId: 'ask', questionId: 'q1', until: expect.any(Number) }] })

    expect((await post('/api/questions/answer', { sessionId: 'ask', questionId: 'q1', answers: { 'Which?': '' } })).status).toBe(400)
    const answered = await post('/api/questions/answer', { sessionId: 'ask', questionId: 'q1', answers: { 'Which?': 'B' } })
    expect(answered.status).toBe(200)
    expect(await (await held).json()).toEqual({ answers: { 'Which?': 'B' } })
    const again = await post('/api/questions/answer', { sessionId: 'ask', questionId: 'q1', answers: { 'Which?': 'A' } })
    expect([again.status, await again.json()]).toEqual([409, { error: 'closed' }])

    await v.until(() => v.frames.some(f => f.type === 'message-upsert'))
    expect(v.frames.filter(f => f.type === 'hold').map(f => f.until === null)).toEqual([false, true])
    expect(v.frames.find(f => f.type === 'message-upsert')).toMatchObject({ message: { questionId: 'q1', answer: { answers: { 'Which?': 'B' }, via: 'app' } } })
    // The PostToolUse that follows reports the same answer; the app's record stays
    await post('/api/events', { kind: 'answer', session: info, questionId: 'q1', answers: { 'Which?': 'B' } })
    const stored = (await (await fetch(`${url}/api/messages`)).json() as { questionId?: string, answer?: { via: string } }[]).find(m => m.questionId === 'q1')
    expect(stored?.answer?.via).toBe('app')
    v.ws.close()
    late.ws.close()
  })

  test('a hook that goes away (Esc) drops its hold', async () => {
    await start('ask', 'claude-code')
    await setAnswer('on')
    const v = await viewer()
    const abort = new AbortController()
    // The hold answers its headers at once, so the abort lands while the body is read
    const held = hold('q2', abort.signal).then(r => r.text()).catch(() => null)
    await v.until(() => v.frames.some(f => f.type === 'hold' && f.questionId === 'q2'))
    abort.abort()
    await held
    await v.until(() => v.frames.some(f => f.type === 'hold' && f.questionId === 'q2' && f.until === null))
    expect(v.frames.filter(f => f.type === 'hold' && f.questionId === 'q2').map(f => f.until === null)).toEqual([false, true])
    const late = await post('/api/questions/answer', { sessionId: 'ask', questionId: 'q2', answers: { 'Which?': 'A' } })
    expect(late.status).toBe(409)
    v.ws.close()
    await setAnswer('off')
  })

  test('the decision comes back before the answer, and turning the setting off releases open holds', async () => {
    await start('ask', 'claude-code')
    await setAnswer('on')
    const v = await viewer()
    const started = Date.now()
    const res = await hold('q3')
    // Headers as soon as the hold starts, not when it ends
    expect(Date.now() - started).toBeLessThan(1000)
    await v.until(() => v.frames.some(f => f.type === 'hold' && f.questionId === 'q3'))
    await setAnswer('off')
    expect(await res.json()).toEqual({ hold: false })
    await v.until(() => v.frames.some(f => f.type === 'hold' && f.questionId === 'q3' && f.until === null))
    expect(v.frames.filter(f => f.type === 'hold' && f.questionId === 'q3').map(f => f.until === null)).toEqual([false, true])
    expect((await post('/api/questions/answer', { sessionId: 'ask', questionId: 'q3', answers: { 'Which?': 'A' } })).status).toBe(409)
    v.ws.close()
  })
})

describe('discarding queued feedback', () => {
  test('removes the items still queued for an ended session and tells every view', async () => {
    const post = (path: string, body: unknown) => fetch(`${url}${path}`, { method: 'POST', headers: json, body: JSON.stringify(body) })
    await start('left', 'codex')
    const queued = await (await post('/api/feedback', { sessionId: 'left', text: 'one more thing' })).json() as { id: number }
    await post('/api/events', { kind: 'session-end', session: { id: 'left', name: 'left', harness: 'codex', cwd: '/a' } })
    const ws = new WebSocket(`${url.replace('http', 'ws')}/ws`)
    const frames: { type: string }[] = []
    ws.onmessage = e => frames.push(JSON.parse(e.data as string))
    await new Promise(resolve => ws.onopen = resolve)

    expect((await post('/api/feedback/discard', { sessionId: 'left', ids: ['x'] })).status).toBe(400)
    expect(await (await post('/api/feedback/discard', { sessionId: 'left', ids: [queued.id] })).json()).toEqual({ ok: true, feedbackIds: [queued.id] })
    for (let i = 0; i < 50 && !frames.some(f => f.type === 'deleted'); i++)
      await Bun.sleep(10)
    expect(frames.find(f => f.type === 'deleted')).toMatchObject({ messageIds: [], feedbackIds: [queued.id], sessionIds: [] })
    ws.close()
  })
})
