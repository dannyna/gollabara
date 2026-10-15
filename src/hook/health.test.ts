import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { errorClass, HEALTH_FILE, HEALTH_ROTATED, HttpError, logHealth, percentile, readHealth } from './health'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gollabara-health-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function size(name: string): number {
  try {
    return statSync(join(dir, name)).size
  }
  catch {
    return 0
  }
}

describe('hook health log', () => {
  test('never grows past its cap: one rotated generation and the current file, each under the cap', () => {
    const max = 1024
    for (let i = 0; i < 500; i++) {
      logHealth(dir, { at: i, event: 'PostToolUse', harness: 'claude-code', ms: i % 40, ok: i % 7 !== 0, ...(i % 7 ? {} : { error: 'timeout' }) }, max)
      expect(size(HEALTH_FILE)).toBeLessThanOrEqual(max)
      expect(size(HEALTH_ROTATED)).toBeLessThanOrEqual(max)
    }
    const entries = readHealth(dir)
    // Only the newest runs survive, oldest first
    expect(entries.at(-1)?.at).toBe(499)
    expect(entries.length).toBeLessThan(500)
    expect(entries.map(e => e.at)).toEqual(entries.map(e => e.at).sort((a, b) => a - b))
  })

  test('a missing data dir is created, and an unwritable one is swallowed', () => {
    const nested = join(dir, 'a', 'b')
    logHealth(nested, { at: 1, event: 'Stop', ms: 3, ok: true })
    expect(readHealth(nested)).toEqual([{ at: 1, event: 'Stop', ms: 3, ok: true }])
    // A file where the directory should be: the write fails quietly
    expect(() => logHealth(join(nested, HEALTH_FILE, 'x'), { at: 2, event: 'Stop', ms: 1, ok: true })).not.toThrow()
  })

  test('failures are classed without their text', () => {
    expect(errorClass(new DOMException('t', 'TimeoutError'))).toBe('timeout')
    expect(errorClass(Object.assign(new Error('refused'), { code: 'ConnectionRefused' }))).toBe('unreachable')
    expect(errorClass(new HttpError(500))).toBe('http-500')
    expect(errorClass(new SyntaxError('secret payload'))).toBe('error')
  })

  test('percentiles by nearest rank', () => {
    const ms = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(percentile(ms, 0.5)).toBe(50)
    expect(percentile(ms, 0.95)).toBe(95)
    expect(percentile([], 0.95)).toBe(0)
  })
})
