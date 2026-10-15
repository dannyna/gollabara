// First run and empty states (#75): which harnesses are connected and what to do next, read only from
// what the server already knows: the hooks `GET /api/health` has heard from, and the sessions.

import type { Harness, Health, HookSeen, Session } from '../../src/shared/types'
import { ref, shallowRef } from 'vue'
import { clock } from './artifacts'

const startOfDay = (at: number) => new Date(at).setHours(0, 0, 0, 0)

export const HARNESS_LABEL: Record<Harness, string> = {
  'claude-code': 'Claude Code',
  // Runs through the Claude Code plugin, under its own name
  'open-design': 'Open Design',
  'codex': 'Codex',
  'claude-design': 'Claude Design',
}

export interface HarnessLine {
  harness: Harness
  label: string
  /** The latest hook request, or the latest session event on servers that keep no hook record */
  seenAt: number
  outdated: boolean
  /** The hook's version when it is outdated: null for a hook from before the version handshake */
  version?: string | null
}

/**
 * - `setup`: no harness ever posted; install the plugins
 * - `update`: a hook is older than the server
 * - `start`: connected, but no session is running today
 * - `wait`: a session is running; its work shows up as it comes
 * - `ended`: the session in view ended
 */
export type NextStep = 'setup' | 'update' | 'start' | 'wait' | 'ended'

export interface Guide {
  harnesses: HarnessLine[]
  step: NextStep
}

/** Where the guide is drawn; the next step reads differently in each */
export type GuidePlace = 'page' | 'stream' | 'chat'

/** One line per harness the server heard from, most recent first. Sessions fill in for older servers. */
export function connectedHarnesses(hooks: HookSeen[], sessions: Session[]): HarnessLine[] {
  const lines = new Map<Harness, HarnessLine>()
  for (const h of hooks)
    lines.set(h.harness, { harness: h.harness, label: HARNESS_LABEL[h.harness] ?? h.harness, seenAt: h.seenAt, outdated: h.outdated, ...(h.outdated ? { version: h.version } : {}) })
  for (const s of sessions) {
    const line = lines.get(s.harness)
    if (!line)
      lines.set(s.harness, { harness: s.harness, label: HARNESS_LABEL[s.harness] ?? s.harness, seenAt: s.lastSeenAt, outdated: false })
    else if (s.lastSeenAt > line.seenAt)
      line.seenAt = s.lastSeenAt
  }
  return [...lines.values()].sort((a, b) => b.seenAt - a.seenAt)
}

/**
 * The connected harnesses and the next step. With `scope`, only that session's harness, and the step for
 * that session. A session counts as running when it has not ended and was seen today.
 */
export function firstRunGuide(hooks: HookSeen[], sessions: Session[], scope: string | null = null, now = Date.now()): Guide {
  const all = connectedHarnesses(hooks, sessions)
  const session = scope != null ? sessions.find(s => s.id === scope) : undefined
  if (session) {
    const harnesses = all.filter(h => h.harness === session.harness)
    const step = session.endedAt != null ? 'ended' : harnesses.some(h => h.outdated) ? 'update' : 'wait'
    return { harnesses, step }
  }
  const today = startOfDay(now)
  const running = sessions.some(s => s.endedAt == null && s.lastSeenAt >= today)
  const step = !all.length ? 'setup' : all.some(h => h.outdated) ? 'update' : running ? 'wait' : 'start'
  return { harnesses: all, step }
}

export interface StepCopy {
  title: string
  description?: string
  /** A command to copy, set in mono */
  command?: string
}

/** What the next step says, by where it is drawn */
export function stepCopy(step: NextStep, place: GuidePlace): StepCopy {
  switch (step) {
    case 'setup':
      return { title: '플러그인을 설치해 주세요', description: 'Claude Code와 Codex를 찾아 연결해요. golla가 있다면 golla setup도 같아요.', command: 'bunx gollabara setup' }
    case 'update':
      return { title: '세션을 다시 시작해 주세요', description: '플러그인이 서버보다 오래됐어요. 다시 시작해도 그대로면 업데이트해요.', command: 'golla update' }
    case 'start':
      return { title: '세션을 시작해 보세요', description: 'Claude Code나 Codex에서 세션을 열면 여기에 보여요.' }
    case 'ended':
      return { title: '끝난 세션이에요', description: '세션을 다시 열면 이어서 보여요.' }
    case 'wait':
      return place === 'chat'
        ? { title: '세션이 턴을 마치면 여기에 보여요', description: '한 줄 요약과 세션의 질문이 이어서 올라와요.' }
        : { title: '세션이 만든 이미지가 여기에 모여요', description: '스크린샷을 찍거나 이미지 파일을 읽으면 바로 보여요.' }
  }
}

/** When a harness was last heard from: the time today, else the date, in mono */
export function seenLabel(at: number, now = Date.now()): string {
  if (startOfDay(at) === startOfDay(now))
    return clock(at)
  const d = new Date(at)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** `GET /api/health`, fetched when the views need it; a failure leaves the last answer (null at first) */
export function useHealth(fetcher: typeof fetch = fetch) {
  const health = shallowRef<Health | null>(null)
  /** The first answer, or the first failure, came back */
  const loaded = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  async function refresh() {
    try {
      const res = await fetcher('/api/health')
      if (res.ok)
        health.value = await res.json() as Health
    }
    catch {}
    finally {
      loaded.value = true
    }
  }
  /** Coalesces bursts, e.g. the session frames every hook event sends */
  function schedule(ms = 400) {
    clearTimeout(timer)
    timer = setTimeout(refresh, ms)
  }
  return { health, loaded, refresh, schedule }
}
