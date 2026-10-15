import type { Server } from 'bun'
import type { Session } from '../shared/types'
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
