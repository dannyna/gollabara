// `golla hook` — Claude Code hook 진입점.
// 세션 작업을 절대 막지 않는다: 짧은 타임아웃, 모든 오류 삼킴, 항상 exit 0.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serverUrl } from '../shared/config'
import type { SessionInfo } from '../shared/types'
import { mapHook, sessionName, type HookInput } from './map'

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
    // 서버가 꺼져 있어도 세션은 계속한다
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
