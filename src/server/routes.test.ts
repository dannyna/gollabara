import type { Server } from 'bun'
import type { HistoryPage, Session } from '../shared/types'
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
