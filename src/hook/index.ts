// `golla hook` — Claude Code hook entry point.
// Never blocks the session: short timeout, swallow every error, always exit 0.
// Stdout carries only the feedback JSON for the session, and only when there is feedback.

import type { Feedback } from '../shared/types'
import type { HookInput, TurnOpener } from './map'
import { Buffer } from 'node:buffer'
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { serverUrl } from '../shared/config'
import { feedbackOutput, feedbackVia, mapHook, sessionInfo, turnOpener } from './map'

const POST_TIMEOUT_MS = 1500
/**
 * Tail windows tried in turn until one holds the turn's opening entry. Most turns fit the first;
 * turns that Read screenshots put megabytes between the opener and the end (1.3-3.3 MB in the e2e runs)
 */
const TRANSCRIPT_TAIL_WINDOWS = [256 * 1024, 1024 * 1024, 4 * 1024 * 1024, 8 * 1024 * 1024]

export async function runHook(): Promise<void> {
  // Set by gollabara's own background model calls so they never stream themselves
  if (process.env.GOLLABARA_HOOK === 'off')
    return
  try {
    const raw = await Bun.stdin.text()
    const input = JSON.parse(raw) as HookInput
    // Pick only the keys we use: the rest of the env can hold tool tokens
    const session = sessionInfo(input, { OD_PROJECT_ID: process.env.OD_PROJECT_ID }, { projectRoot, readBranch })
    // Only a first Stop needs to know who started the turn
    const opener = input.hook_event_name === 'Stop' && !input.stop_hook_active ? stopTurnOpener(input.transcript_path) : 'unknown'
    const event = mapHook(input, session, opener)
    // Claude Code runs the hook command as its direct child (a one-command `sh -c` execs it), and it
    // spawns the channel server the same way, so both see the claude pid as their parent
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
  if (!transcriptPath)
    return 'unknown'
  for (const bytes of windows) {
    const tail = readTail(transcriptPath, bytes)
    if (!tail)
      return 'unknown'
    const opener = turnOpener(tail.text)
    if (opener !== 'unknown' || tail.whole)
      return opener
  }
  return 'unknown'
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
