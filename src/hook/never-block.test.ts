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

// `hook.js ask` holds AskUserQuestion for the app (opt-in), so it is exempt from the 1.5 s and 2.5 s budget above.
// It still must never block when nobody can answer, never print anything but the answer, and end by its own deadline.
describe('ask hook', () => {
  const questions = [{ question: 'Which?', header: 'Pick', options: [{ label: 'A', description: 'first' }, { label: 'B' }], multiSelect: false }]
  const ask = JSON.stringify({ session_id: 's', transcript_path: '/nowhere.jsonl', cwd: '/tmp', hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions }, tool_use_id: 'toolu_1' })
  const answering = { answers: { Which: 'B' } as Record<string, string> | null }
  let holdServer: Server<undefined>
  const holdUrl = () => holdServer.url.href.replace(/\/$/, '')
  const bodies: unknown[] = []
  beforeAll(() => {
    holdServer = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      async fetch(req) {
        bodies.push(await req.json())
        return Response.json(answering.answers ? { answers: answering.answers } : { hold: false })
      },
    })
  })
  afterAll(() => holdServer.stop(true))

  test('exits at once, printing nothing, with the server down, with no hold, headless, or with GOLLABARA_HOOK=off', async () => {
    const runs = [
      await hook(ask, { mode: 'ask', url: downUrl }),
      await (async () => {
        answering.answers = null
        return hook(ask, { mode: 'ask', url: holdUrl() })
      })(),
      await hook(ask, { mode: 'ask', url: holdUrl(), env: { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' } }),
      await hook(ask, { mode: 'ask', url: holdUrl(), env: { GOLLABARA_HOOK: 'off' } }),
      await hook(ask, { mode: 'ask', url: holdUrl(), env: { OD_PROJECT_ID: 'od' } }),
    ]
    for (const run of runs) {
      expect({ code: run.code, stdout: run.stdout }).toEqual({ code: 0, stdout: '' })
      expect(run.ms).toBeLessThan(1500)
    }
    // Only the no-hold run reached the server
    expect(bodies).toHaveLength(1)
  }, 15_000)

  test('an answer from the app comes out as the tool input, with the questions as asked', async () => {
    answering.answers = { Which: 'B' }
    bodies.length = 0
    const run = await hook(ask, { mode: 'ask', url: holdUrl() })
    expect(run.code).toBe(0)
    expect(JSON.parse(run.stdout)).toEqual({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { questions, answers: { Which: 'B' } } },
    })
    expect(bodies).toEqual([{ sessionId: 's', questionId: 'toolu_1', questions }])
    // Another tool, or a stalled stdin, never reaches the server
    const other = await hook(ask.replace('AskUserQuestion', 'Bash'), { mode: 'ask', url: holdUrl() })
    expect({ code: other.code, stdout: other.stdout }).toEqual({ code: 0, stdout: '' })
    const stalled = await hook(null, { mode: 'ask', url: holdUrl() })
    expect({ code: stalled.code, stdout: stalled.stdout }).toEqual({ code: 0, stdout: '' })
    expect(stalled.ms).toBeLessThan(3000)
    expect(bodies).toHaveLength(1)
  }, 15_000)

  test('a server that never answers: the hook gives up within its 1.5 s request budget, quietly', async () => {
    reset('hang')
    const run = await hook(ask, { mode: 'ask' })
    expect({ code: run.code, stdout: run.stdout }).toEqual({ code: 0, stdout: '' })
    expect(run.ms).toBeLessThan(2500)
  }, 10_000)

  test('a hold the server started may answer past the 1.5 s budget', async () => {
    // Like the real route: a space at once, the answer later in the body
    const late = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(' '))
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ answers: { Which: 'A' } })))
            controller.close()
          }, 2200)
        },
      })),
    })
    try {
      const run = await hook(ask, { mode: 'ask', url: late.url.href.replace(/\/$/, '') })
      expect(run.code).toBe(0)
      expect(JSON.parse(run.stdout)).toMatchObject({ hookSpecificOutput: { updatedInput: { answers: { Which: 'A' } } } })
      expect(run.ms).toBeGreaterThan(2000)
    }
    finally {
      late.stop(true)
    }
  }, 10_000)
})
