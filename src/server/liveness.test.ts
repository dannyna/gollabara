import type { SessionInfo } from '../shared/types'
import type { ProcessProbe } from './liveness'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, test } from 'bun:test'
import { goneSessions, parseElapsed, SWEEP_MS, systemProbe } from './liveness'
import { Store } from './store'

function probe(alive: number[], started: Record<number, number> = {}): ProcessProbe {
  return {
    alive: pid => alive.includes(pid),
    startedAt: pids => new Map(pids.filter(p => p in started).map(p => [p, started[p]!])),
  }
}

describe('goneSessions', () => {
  test('a pid that answers no signal is gone', () => {
    const links = [{ id: 'a', pid: 1, at: 1000 }, { id: 'b', pid: 2, at: 1000 }]
    expect(goneSessions(links, probe([2], { 2: 900 }))).toEqual(['a'])
  })

  test('a live pid whose process started after the link was reused; a link without a time only gets the signal check', () => {
    const links = [{ id: 'reused', pid: 7, at: 1000 }, { id: 'same', pid: 8, at: 10_000 }, { id: 'legacy', pid: 9, at: null }]
    // Started 9 s after its link vs. 1 s (whole-second ps) before it
    expect(goneSessions(links, probe([7, 8, 9], { 7: 10_000, 8: 9000, 9: 99_000 }))).toEqual(['reused'])
  })

  test('a start time the probe could not read keeps the session', () => {
    expect(goneSessions([{ id: 'a', pid: 1, at: 1000 }], probe([1]))).toEqual([])
  })
})

test('parseElapsed reads ps etime', () => {
  expect(parseElapsed('00:05')).toBe(5000)
  expect(parseElapsed('12:34')).toBe((12 * 60 + 34) * 1000)
  expect(parseElapsed('01:00:00')).toBe(3_600_000)
  expect(parseElapsed('01-10:38:14')).toBe(((24 + 10) * 3600 + 38 * 60 + 14) * 1000)
  expect(parseElapsed('soon')).toBeUndefined()
})

describe('a real process', () => {
  // The server sweeps every SWEEP_MS, so a session whose process went away is marked within a minute
  test('a session is marked ended once its process exits, within one sweep', async () => {
    expect(SWEEP_MS).toBeLessThanOrEqual(30_000)
    const dir = mkdtempSync(join(tmpdir(), 'gollabara-liveness-'))
    try {
      const store = new Store(dir)
      const child = Bun.spawn(['sleep', '30'])
      const session: SessionInfo = { id: 'live', name: 'live', harness: 'claude-code', cwd: '/a' }
      store.ingest({ kind: 'session', session, pid: child.pid })
      const sweep = () => store.endSessions(goneSessions(store.pidLinks(), systemProbe)).map(s => s.id)
      expect(sweep()).toEqual([])
      child.kill()
      await child.exited
      expect(sweep()).toEqual(['live'])
      expect(store.session('live')?.endedAt).toBeNumber()
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('the system probe reads its own process as alive and started before now', () => {
    expect(systemProbe.alive(process.pid)).toBe(true)
    const now = Date.now()
    const started = systemProbe.startedAt([process.pid], now).get(process.pid)
    expect(started).toBeLessThanOrEqual(now)
  })
})
