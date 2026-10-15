import type { Feedback } from '../shared/types'
import type { PollResult } from './wait'
import { resolve } from 'node:path'
import process from 'node:process'
import { describe, expect, test } from 'bun:test'
import { waitForFeedback } from './wait'

const BUNDLE = resolve(import.meta.dir, '../../plugin/bin/hook.js')

const item: Feedback = { id: 1, sessionId: 's1', text: 'make it blue', createdAt: 0 }

/** Answers each poll from the list in turn, counting the polls and the time slept */
function scripted(results: PollResult[]) {
  const state = { polls: 0, slept: 0 }
  const poll = async () => results[Math.min(state.polls++, results.length - 1)]!
  const sleep = async (ms: number) => {
    state.slept += ms
  }
  return { state, poll, sleep }
}

describe('wake-up waiter', () => {
  test('polls through empty answers until feedback arrives', async () => {
    const { state, poll, sleep } = scripted([{ items: [] }, { items: [] }, { items: [item] }])
    expect(await waitForFeedback(poll, { deadline: Infinity, sleep })).toEqual([item])
    expect(state.polls).toBe(3)
  })

  test('stops quietly when the server says so (newer waiter, or the user took over)', async () => {
    const { state, poll, sleep } = scripted([{ items: [] }, 'stop', { items: [item] }])
    expect(await waitForFeedback(poll, { deadline: Infinity, sleep })).toBeNull()
    expect(state.polls).toBe(2)
  })

  test('rides out a short server restart, but gives up on one that stays down', async () => {
    const restart = scripted(['down', 'down', { items: [item] }])
    expect(await waitForFeedback(restart.poll, { deadline: Infinity, sleep: restart.sleep })).toEqual([item])
    const down = scripted(['down'])
    expect(await waitForFeedback(down.poll, { deadline: Infinity, sleep: down.sleep })).toBeNull()
    expect(down.state.polls).toBe(4)
  })

  test('starts no poll that could outlast the hook timeout', async () => {
    let now = 0
    const { state, poll, sleep } = scripted([{ items: [] }])
    const timed = async () => {
      now += 25_000
      return poll()
    }
    expect(await waitForFeedback(timed, { deadline: 100_000, now: () => now, sleep })).toBeNull()
    expect(state.polls).toBe(3)
  })

  test('stops once Claude Code is gone', async () => {
    const { state, poll, sleep } = scripted([{ items: [] }])
    let alive = true
    const once = async () => {
      alive = false
      return poll()
    }
    expect(await waitForFeedback(once, { deadline: Infinity, sleep, alive: () => alive })).toBeNull()
    expect(state.polls).toBe(1)
  })
})

/** One run of the bundled wake-up hook against a stub that answers every request with `status`, or never */
async function runBundle(entrypoint: string, status: number | 'hang') {
  const paths: string[] = []
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(req) {
      paths.push(new URL(req.url).pathname)
      return status === 'hang' ? new Promise<Response>(() => {}) : new Response(null, { status })
    },
  })
  try {
    const started = performance.now()
    const proc = Bun.spawn([process.execPath, BUNDLE, 'wait'], {
      stdin: new Blob([JSON.stringify({ session_id: 's1', hook_event_name: 'Stop' })]),
      stdout: 'ignore',
      stderr: 'ignore',
      env: { PATH: process.env.PATH ?? '', GOLLABARA_URL: server.url.href.replace(/\/$/, ''), CLAUDE_CODE_ENTRYPOINT: entrypoint },
    })
    const code = await proc.exited
    return { code, paths, ms: performance.now() - started }
  }
  finally {
    server.stop(true)
  }
}

describe('wake-up hook in headless runs', () => {
  test('exits at once under claude -p and the Agent SDK, without polling', async () => {
    for (const entrypoint of ['sdk-cli', 'sdk-ts', 'sdk-py']) {
      const run = await runBundle(entrypoint, 'hang')
      expect(run.code).toBe(0)
      expect(run.paths).toEqual([])
      expect(run.ms).toBeLessThan(2000)
    }
  })

  test('still waits in an interactive session', async () => {
    const run = await runBundle('cli', 410)
    expect(run.code).toBe(0)
    expect(run.paths).toEqual(['/api/channel/wait'])
  })
})
