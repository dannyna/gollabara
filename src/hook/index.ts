// `golla hook` — Claude Code hook entry point.
// Never blocks the session: short timeout, swallow every error, always exit 0.
// Stdout carries only the feedback JSON for the session, and only when there is feedback.

import type { Feedback, ImageRole } from '../shared/types'
import type { HookInput, TurnOpener } from './map'
import { Buffer } from 'node:buffer'
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { serverUrl } from '../shared/config'
import { feedbackOutput, feedbackVia, imageRole, mapHook, sessionInfo, sessionStartedAt, turnOpener, turnStartedAt } from './map'

const POST_TIMEOUT_MS = 1500
/**
 * Tail windows tried in turn until one holds the turn's opening entry. Most turns fit the first;
 * turns that Read screenshots put megabytes between the opener and the end (1.3-3.3 MB in the e2e runs)
 */
const TRANSCRIPT_TAIL_WINDOWS = [256 * 1024, 1024 * 1024, 4 * 1024 * 1024, 8 * 1024 * 1024]
/** The transcript's first entries carry a timestamp well within this */
const TRANSCRIPT_HEAD_BYTES = 64 * 1024

export async function runHook(): Promise<void> {
  // Set by gollabara's own background model calls so they never stream themselves
  if (process.env.GOLLABARA_HOOK === 'off')
    return
  try {
    const raw = await Bun.stdin.text()
    const input = JSON.parse(raw) as HookInput
    // Pick only the keys we use: the rest of the env can hold tool tokens
    const session = sessionInfo(input, { OD_PROJECT_ID: process.env.OD_PROJECT_ID }, { projectRoot, readBranch })
    // Every Stop: a wake-up's Stop comes as `stop_hook_active` too, yet opens its own turn
    const opener = input.hook_event_name === 'Stop' ? stopTurnOpener(input.transcript_path) : 'unknown'
    const event = mapHook(input, session, opener, path => readFileRole(path, input.transcript_path))
    // Claude Code runs the hook command as its direct child (a one-command `sh -c` execs it), so every
    // hook, the wake-up waiter included, sees the claude pid as its parent
    if (event?.kind === 'session')
      event.pid = process.ppid
    const via = feedbackVia(input.hook_event_name)
    // Event and claim share one budget and run side by side; most tool calls only claim
    const signal = AbortSignal.timeout(POST_TIMEOUT_MS)
    const post = (path: string, body: unknown) => fetch(`${serverUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    const [, claimed] = await Promise.allSettled([
      event ? post('/api/events', event) : null,
      via ? post('/api/feedback/claim', { sessionId: session.id, via }).then(r => r.ok ? r.json() as Promise<Feedback[]> : []) : [],
    ])
    const items = claimed.status === 'fulfilled' && Array.isArray(claimed.value) ? claimed.value : []
    const output = feedbackOutput(input.hook_event_name, items)
    // Awaited so the bytes are out before entry.ts calls process.exit
    if (output)
      await Bun.write(Bun.stdout, JSON.stringify(output))
  }
  catch {
    // The session keeps going even if the server is down
  }
}

/** Who opened the turn, from the transcript's tail; 'unknown' (so the recap is posted) when it can't be read */
export function stopTurnOpener(transcriptPath?: string, windows = TRANSCRIPT_TAIL_WINDOWS): TurnOpener {
  return fromTail(transcriptPath, (text) => {
    const opener = turnOpener(text)
    return opener === 'unknown' ? undefined : opener
  }, windows) ?? 'unknown'
}

/**
 * When the current turn started, from its opener in the transcript's tail, else when the session
 * started (the transcript's head); undefined when neither can be read
 */
export function turnStart(transcriptPath?: string, windows = TRANSCRIPT_TAIL_WINDOWS): number | undefined {
  const opened = fromTail(transcriptPath, turnStartedAt, windows)
  if (opened !== undefined || !transcriptPath)
    return opened
  const head = readHead(transcriptPath, TRANSCRIPT_HEAD_BYTES)
  return head === undefined ? undefined : sessionStartedAt(head)
}

/**
 * The role of images read from `path`: an artifact when the file changed after the turn started.
 * Only image reads get here, so other tool calls never stat. Any error makes it an artifact.
 */
export function readFileRole(path: string, transcriptPath?: string, windows = TRANSCRIPT_TAIL_WINDOWS): ImageRole {
  try {
    return imageRole(statSync(path).mtimeMs, turnStart(transcriptPath, windows))
  }
  catch {
    return 'artifact'
  }
}

/** Reads ever wider tails until `find` answers, or the whole file was read */
function fromTail<T>(path: string | undefined, find: (text: string) => T | undefined, windows: number[]): T | undefined {
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

export function projectRoot(cwd: string): string {
  // `.git` is a dir in a plain clone and a file in worktrees and submodules
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git')))
      return dir
    if (dirname(dir) === dir)
      return cwd
  }
}

export function readBranch(root: string): string | undefined {
  try {
    const dotGit = join(root, '.git')
    let gitDir = dotGit
    if (statSync(dotGit).isFile()) {
      const line = readFileSync(dotGit, 'utf8').trim()
      if (!line.startsWith('gitdir:'))
        return undefined
      gitDir = resolve(root, line.slice('gitdir:'.length).trim())
    }
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim()
    return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : undefined
  }
  catch {
    return undefined
  }
}
