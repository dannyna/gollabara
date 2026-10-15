// Bounded reads of a session's transcript (Claude Code) or rollout (Codex), shared by the adapters.
// Every read is capped and swallows its errors, so a huge or missing file never holds up a hook.

import { Buffer } from 'node:buffer'
import { closeSync, fstatSync, openSync, readSync } from 'node:fs'

/**
 * Tail windows tried in turn until one holds the turn's opening entry. Most turns fit the first;
 * turns that Read screenshots put megabytes between the opener and the end (1.3-3.3 MB in the e2e runs)
 */
export const TRANSCRIPT_TAIL_WINDOWS = [256 * 1024, 1024 * 1024, 4 * 1024 * 1024, 8 * 1024 * 1024]
/** The transcript's first entries carry a timestamp well within this */
export const TRANSCRIPT_HEAD_BYTES = 64 * 1024

/** Reads ever wider tails until `find` answers, or the whole file was read */
export function fromTail<T>(path: string | undefined, find: (text: string) => T | undefined, windows: number[]): T | undefined {
  if (!path)
    return undefined
  for (const bytes of windows) {
    const tail = readTail(path, bytes)
    if (!tail)
      return undefined
    const found = find(tail.text)
    if (found !== undefined || tail.whole)
      return found
  }
  return undefined
}

/** The first `bytes` of a file; undefined when it can't be read */
export function readHead(path: string, bytes: number): string | undefined {
  try {
    const fd = openSync(path, 'r')
    try {
      const buffer = Buffer.alloc(Math.min(fstatSync(fd).size, bytes))
      readSync(fd, buffer, 0, buffer.length, 0)
      return buffer.toString('utf8')
    }
    finally {
      closeSync(fd)
    }
  }
  catch {
    return undefined
  }
}

/** The last `bytes` of a file, and whether that is the whole file; undefined when it can't be read */
export function readTail(path: string, bytes: number): { text: string, whole: boolean } | undefined {
  try {
    const fd = openSync(path, 'r')
    try {
      const size = fstatSync(fd).size
      const length = Math.min(size, bytes)
      const buffer = Buffer.alloc(length)
      readSync(fd, buffer, 0, length, size - length)
      return { text: buffer.toString('utf8'), whole: length === size }
    }
    finally {
      closeSync(fd)
    }
  }
  catch {
    return undefined
  }
}
