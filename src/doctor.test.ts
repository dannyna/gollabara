import type { Server } from 'bun'
import type { StreamMessage } from './shared/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { doctor } from './doctor'
import { startServer } from './server'
import { PLUGIN_VERSION } from './shared/version'

const ENV = ['GOLLABARA_DATA', 'GOLLABARA_PORT', 'GOLLABARA_HOST'] as const
const saved = Object.fromEntries(ENV.map(k => [k, process.env[k]]))
const data = mkdtempSync(join(tmpdir(), 'gollabara-doctor-'))
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

const recap = (harness: string, id: string) => ({ kind: 'recap', session: { id, name: 'piuda', harness, cwd: '/a' }, text: 'done' })
function post(body: object, headers: Record<string, string> = {}) {
  return fetch(`${url}/api/events`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
}

describe('golla doctor', () => {
  test('an event from an older hook (no version header) is stored and its plugin reads as outdated', async () => {
    expect((await post(recap('open-design', 'old'))).ok).toBe(true)
    const messages = await (await fetch(`${url}/api/messages`)).json() as StreamMessage[]
    expect(messages.map(m => m.sessionId)).toContain('old')

    const health = await (await fetch(`${url}/api/health`)).json()
    expect(health).toMatchObject({ version: PLUGIN_VERSION, hooks: [{ harness: 'open-design', version: null, outdated: true }] })
    const report = (await doctor({ url, dataDir: data })).lines
    expect(report).toContain(`plugin    open-design no version (plugin outdated, expected ${PLUGIN_VERSION}), seen 0 s ago`)
  })

  test('a current hook reads as ok, an older version as outdated', async () => {
    await post(recap('claude-code', 'new'), { 'x-gollabara-hook': PLUGIN_VERSION, 'x-gollabara-harness': 'claude-code' })
    expect((await doctor({ url, dataDir: data })).lines.join('\n')).toContain(`claude-code ${PLUGIN_VERSION} (ok)`)
    await post(recap('claude-code', 'new'), { 'x-gollabara-hook': '0.0.1', 'x-gollabara-harness': 'claude-code' })
    expect((await doctor({ url, dataDir: data })).lines.join('\n')).toContain('claude-code 0.0.1 (plugin outdated')
  })

  test('an unreachable server and an empty log are stated plainly', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'gollabara-doctor-empty-'))
    try {
      expect(await doctor({ url: 'http://127.0.0.1:9', dataDir: empty })).toEqual({ broken: true, lines: [
        'server    http://127.0.0.1:9 not reachable (unreachable)',
        'latency   no hook runs logged',
        'failures  none logged',
        `data      ${empty}`,
      ] })
    }
    finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
