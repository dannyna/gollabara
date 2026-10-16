// The never-block checklist for the Codex adapter (#72), run against the shipped bundle (`plugin/bin/hook.js
// codex`; CI checks it matches the source) with the payloads recorded in the spike. Every run gets its own
// env: a stub server, a scratch GOLLABARA_DATA for the health log, and no GOLLABARA_HOOK. The SessionEnd budget
// tests (#104) run the same bundle as Claude Code's `hook.js session-end` and as Codex's SessionEnd.
import type { Server } from 'bun'
import type { Feedback } from '../shared/types'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { percentile } from './health'

const BUNDLE = resolve(import.meta.dir, '../../plugin/bin/hook.js')
const FIXTURES = join(import.meta.dir, 'fixtures', 'codex')
const fixtures = Object.fromEntries(readdirSync(FIXTURES).map(name => [name, readFileSync(join(FIXTURES, name), 'utf8')]))
const data = mkdtempSync(join(tmpdir(), 'gollabara-never-block-'))

/** What the stub does: answer (and hand out `queued` on a claim), answer 500, or never answer */
type Mode = 'ok' | 'error' | 'hang'
const stub = { mode: 'ok' as Mode, queued: [] as Feedback[], requests: [] as string[] }
let server: Server<undefined>
let downUrl: string

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      const path = new URL(req.url).pathname
      stub.requests.push(path)
      if (stub.mode === 'hang')
        return new Promise<Response>(() => {})
      if (stub.mode === 'error')
        return new Response('boom', { status: 500 })
      if (path === '/api/feedback/claim') {
        const items = stub.queued
        stub.queued = []
        return Response.json(items)
      }
      return Response.json({ ok: true })
    },
  })
  // A port that was just free and is closed again: nothing listens there
  const closed = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() })
  downUrl = `http://127.0.0.1:${closed.port}`
  closed.stop(true)
})
afterAll(() => {
  server.stop(true)
  rmSync(data, { recursive: true, force: true })
})

function reset(mode: Mode, queued: Feedback[] = []) {
  Object.assign(stub, { mode, queued, requests: [] })
}

const item: Feedback = { id: 1, sessionId: 's', text: 'make the header blue', createdAt: 0 }

interface Run { code: number, stdout: string, ms: number }

/** One run of the bundled hook as Codex starts it (or Claude Code, with its `mode` argument): payload on stdin, codex's env (no login shell) */
async function hook(stdin: string | null, { url = server.url.href.replace(/\/$/, ''), env = {} as Record<string, string>, mode = 'codex' } = {}): Promise<Run> {
  const started = performance.now()
  const proc = Bun.spawn([process.execPath, BUNDLE, mode], {
    stdin: stdin === null ? 'pipe' : new Blob([stdin]),
    stdout: 'pipe',
    stderr: 'ignore',
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', GOLLABARA_URL: url, GOLLABARA_DATA: data, ...env },
  })
  const stdout = await new Response(proc.stdout).text()
  const code = await proc.exited
  return { code, stdout, ms: performance.now() - started }
}

/** Codex fails a hook that prints anything but JSON, and a Stop that returns additionalContext */
function expectValidOutput(name: string, stdout: string) {
  if (!stdout)
    return
  const out = JSON.parse(stdout)
  if (name.startsWith('stop'))
    expect(out).toEqual({ decision: 'block', reason: expect.stringContaining('make the header blue') })
  else
    expect(out.hookSpecificOutput.additionalContext).toContain('make the header blue')
}

describe('Codex never-block checklist', () => {
  test('exit 0 and only valid output on every recorded payload, with feedback waiting', async () => {
    for (const [name, payload] of Object.entries(fixtures)) {
      reset('ok', [item])
      const run = await hook(payload)
      expect({ name, code: run.code }).toEqual({ name, code: 0 })
      expectValidOutput(name, run.stdout)
    }
  }, 30_000)

  test('server down or failing: exit 0, nothing printed, no wait past the budget', async () => {
    for (const [name, payload] of Object.entries(fixtures)) {
      const down = await hook(payload, { url: downUrl })
      expect({ name, code: down.code, stdout: down.stdout }).toEqual({ name, code: 0, stdout: '' })
      expect(down.ms).toBeLessThan(1500)
      reset('error', [item])
      const failing = await hook(payload)
      expect({ name, code: failing.code, stdout: failing.stdout }).toEqual({ name, code: 0, stdout: '' })
    }
  }, 30_000)

  test('hard deadline: a server that never answers is cut at the 1.5 s budget, a stalled stdin by the 2.5 s deadline', async () => {
    reset('hang')
    const hung = await hook(fixtures['post-bash.json']!)
    expect(hung.code).toBe(0)
    expect(hung.stdout).toBe('')
    expect(hung.ms).toBeGreaterThan(1400)
    expect(hung.ms).toBeLessThan(2400)
    // Codex closes stdin; if it ever did not, the deadline still ends the hook well before Codex's 3 s and 5 s timeouts
    const stalled = await hook(null)
    expect(stalled.code).toBe(0)
    expect(stalled.ms).toBeGreaterThan(2400)
    expect(stalled.ms).toBeLessThan(3000)
  }, 15_000)

  test('loop guard: a Stop that is already continuing never claims, so it never blocks again', async () => {
    reset('ok', [item])
    const first = await hook(fixtures['stop.json']!)
    expect(JSON.parse(first.stdout)).toEqual({ decision: 'block', reason: expect.stringContaining('make the header blue') })
    expect(stub.requests).toContain('/api/feedback/claim')

    reset('ok', [item])
    const continued = await hook(fixtures['stop-hook-active.json']!)
    expect(continued.stdout).toBe('')
    expect(stub.requests).toEqual(['/api/events'])
    // The feedback stays queued for the next tool call or prompt
    expect(stub.queued).toEqual([item])
  }, 15_000)

  test('malformed input and GOLLABARA_HOOK=off: exit 0, nothing sent or printed', async () => {
    reset('ok', [item])
    for (const stdin of ['', 'not json', '{"hook_event_name":"Stop"}']) {
      const run = await hook(stdin)
      expect({ stdin, code: run.code, stdout: run.stdout }).toEqual({ stdin, code: 0, stdout: '' })
    }
    reset('ok', [item])
    const off = await hook(fixtures['stop.json']!, { env: { GOLLABARA_HOOK: 'off' } })
    expect({ code: off.code, stdout: off.stdout, requests: stub.requests }).toEqual({ code: 0, stdout: '', requests: [] })
  }, 15_000)

  test('latency: p95 under 300 ms over 40 runs against a local server', async () => {
    reset('ok')
    const ms: number[] = []
    for (let i = 0; i < 40; i++) {
      const run = await hook(fixtures[i % 2 ? 'post-bash.json' : 'stop.json']!)
      expect(run.code).toBe(0)
      ms.push(run.ms)
    }
    ms.sort((a, b) => a - b)
    const p95 = percentile(ms, 0.95)
    console.warn(`codex hook latency over ${ms.length} runs: p50 ${percentile(ms, 0.5).toFixed(0)} ms, p95 ${p95.toFixed(0)} ms, max ${ms.at(-1)!.toFixed(0)} ms`)
    expect(p95).toBeLessThan(300)
  }, 60_000)
})

// Claude Code cancels SessionEnd hooks 1.5 s after it starts them and prints "Hook cancelled" (#104). The bound
// leaves room for a slow CI runner; locally a cut request ends at about 780 ms and a stalled stdin at 1000 ms.
describe('SessionEnd budget', () => {
  const SESSION_END_BOUND_MS = 1300
  const claudeSessionEnd = JSON.stringify({ session_id: 's', transcript_path: '/nowhere.jsonl', cwd: '/tmp', hook_event_name: 'SessionEnd', reason: 'prompt_input_exit' })

  test('a server that never answers: Claude Code\'s SessionEnd exits 0 within its budget and prints nothing', async () => {
    reset('hang')
    const run = await hook(claudeSessionEnd, { mode: 'session-end' })
    expect({ code: run.code, stdout: run.stdout, requests: stub.requests }).toEqual({ code: 0, stdout: '', requests: ['/api/events'] })
    expect(run.ms).toBeGreaterThan(700)
    expect(run.ms).toBeLessThan(SESSION_END_BOUND_MS)
  }, 10_000)

  test('a stalled stdin: the session-end argument sets the short deadline before the event is read', async () => {
    const run = await hook(null, { mode: 'session-end' })
    expect({ code: run.code, stdout: run.stdout }).toEqual({ code: 0, stdout: '' })
    expect(run.ms).toBeGreaterThan(900)
    expect(run.ms).toBeLessThan(SESSION_END_BOUND_MS)
  }, 10_000)

  test('Codex\'s SessionEnd, which carries no argument, gets the same budget from its event', async () => {
    reset('hang')
    const run = await hook(fixtures['session-end.json']!)
    expect({ code: run.code, stdout: run.stdout }).toEqual({ code: 0, stdout: '' })
    expect(run.ms).toBeLessThan(SESSION_END_BOUND_MS)
  }, 10_000)
})
