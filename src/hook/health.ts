// Hook health log: one JSON line per hook run with its latency and outcome, so `golla doctor` can show
// failures the hook swallows (invariant 2). It holds no payload text: event name, harness, ms, error class.
// One small synchronous append per run, and every error is swallowed, so it never slows or breaks a hook.

import type { Harness } from '../shared/types'
import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const HEALTH_FILE = 'hook-health.jsonl'
/** The previous generation; the log keeps at most these two files */
export const HEALTH_ROTATED = 'hook-health.1.jsonl'
/** Per file, so the log stays under 256 KB (a run is about 100 bytes) */
export const HEALTH_MAX_BYTES = 128 * 1024

export interface HealthEntry {
  at: number
  /** The hook event, e.g. PostToolUse */
  event: string
  harness?: Harness
  /** From the hook's start until its requests settled */
  ms: number
  ok: boolean
  /** Why a run failed: timeout, unreachable, http-<status>, or error */
  error?: string
}

/** Appends one entry, rotating first when it would push the file past `max` bytes. Never throws. */
export function logHealth(dir: string, entry: HealthEntry, max = HEALTH_MAX_BYTES): void {
  try {
    const path = join(dir, HEALTH_FILE)
    const line = `${JSON.stringify(entry)}\n`
    let size = 0
    try {
      size = statSync(path).size
    }
    catch {
      mkdirSync(dir, { recursive: true })
    }
    if (size && size + line.length > max)
      renameSync(path, join(dir, HEALTH_ROTATED))
    appendFileSync(path, line)
  }
  catch {
    // A health log must never cost the session anything
  }
}

/** Every readable entry, oldest first */
export function readHealth(dir: string): HealthEntry[] {
  const entries: HealthEntry[] = []
  for (const name of [HEALTH_ROTATED, HEALTH_FILE]) {
    let text = ''
    try {
      text = readFileSync(join(dir, name), 'utf8')
    }
    catch {
      continue
    }
    for (const line of text.split('\n')) {
      try {
        const entry = JSON.parse(line) as HealthEntry
        if (typeof entry?.ms === 'number' && typeof entry.at === 'number')
          entries.push(entry)
      }
      catch {
        // A torn or empty line
      }
    }
  }
  return entries.sort((a, b) => a.at - b.at)
}

/** The class of a failed request, short enough for a log line */
export function errorClass(reason: unknown): string {
  if (reason instanceof HttpError)
    return `http-${reason.status}`
  const name = (reason as { name?: unknown })?.name
  if (name === 'TimeoutError' || name === 'AbortError')
    return 'timeout'
  const code = (reason as { code?: unknown })?.code
  if (code === 'ConnectionRefused' || code === 'ECONNREFUSED')
    return 'unreachable'
  return 'error'
}

/** A response the server answered with a non-2xx status */
export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`http ${status}`)
  }
}

/** The value at fraction `p` of the sorted values (nearest rank) */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length)
    return 0
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!
}
