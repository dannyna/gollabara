// `golla hook` — Claude Code hook entry point.
// Never blocks the session: short timeout, swallow every error, always exit 0.
// Stdout carries only the feedback JSON for the session, and only when there is feedback.

import type { Feedback } from '../shared/types'
import type { HookInput } from './map'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { serverUrl } from '../shared/config'
import { feedbackOutput, feedbackVia, mapHook, sessionInfo } from './map'

const POST_TIMEOUT_MS = 1500

export async function runHook(): Promise<void> {
  try {
    const raw = await Bun.stdin.text()
    const input = JSON.parse(raw) as HookInput
    // Pick only the keys we use: the rest of the env can hold tool tokens
    const session = sessionInfo(input, { OD_PROJECT_ID: process.env.OD_PROJECT_ID }, { projectRoot, readBranch })
    const event = mapHook(input, session)
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
