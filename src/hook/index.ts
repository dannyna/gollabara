// `golla hook` — Claude Code hook entry point.
// Never blocks the session: short timeout, swallow every error, always exit 0.

import type { SessionInfo } from '../shared/types'
import type { HookInput } from './map'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serverUrl } from '../shared/config'
import { mapHook, sessionName } from './map'

const POST_TIMEOUT_MS = 1500

export async function runHook(): Promise<void> {
  try {
    const raw = await Bun.stdin.text()
    const input = JSON.parse(raw) as HookInput
    const session: SessionInfo = {
      id: input.session_id,
      name: sessionName(input.cwd, readBranch(input.cwd)),
      cwd: input.cwd,
    }
    const event = mapHook(input, session)
    if (!event)
      return
    await fetch(`${serverUrl()}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    })
  }
  catch {
    // The session keeps going even if the server is down
  }
}

function readBranch(cwd: string): string | undefined {
  try {
    const head = readFileSync(join(cwd, '.git', 'HEAD'), 'utf8').trim()
    return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : undefined
  }
  catch {
    return undefined
  }
}
