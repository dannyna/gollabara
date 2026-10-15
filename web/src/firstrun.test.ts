import type { Harness, HookSeen, Session } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { connectedHarnesses, firstRunGuide, seenLabel, stepCopy, useHealth } from './firstrun'

const NOW = new Date(2026, 9, 16, 15, 0).getTime()
const TODAY = new Date(2026, 9, 16, 9, 30).getTime()
const YESTERDAY = new Date(2026, 9, 15, 20, 0).getTime()

const hook = (harness: Harness, seenAt: number, outdated = false, version: string | null = '0.3.0'): HookSeen => ({ harness, version, seenAt, outdated })
function session(id: string, harness: Harness, lastSeenAt: number, endedAt?: number): Session {
  return { id, name: id, harness, cwd: '/', startedAt: lastSeenAt, lastSeenAt, ...(endedAt ? { endedAt } : {}) }
}

describe('connectedHarnesses', () => {
  it('lists each harness a hook posted from, newest first; sessions fill in for servers without hook records', () => {
    expect(connectedHarnesses([hook('codex', YESTERDAY), hook('claude-code', TODAY, true, null)], [session('od', 'open-design', TODAY - 1)])).toEqual([
      { harness: 'claude-code', label: 'Claude Code', seenAt: TODAY, outdated: true, version: null },
      { harness: 'open-design', label: 'Open Design', seenAt: TODAY - 1, outdated: false },
      { harness: 'codex', label: 'Codex', seenAt: YESTERDAY, outdated: false },
    ])
  })
})

describe('firstRunGuide', () => {
  it('asks for setup when no harness ever posted', () => {
    expect(firstRunGuide([], [], null, NOW)).toEqual({ harnesses: [], step: 'setup' })
  })

  it('asks to restart or update when a hook is outdated, before anything else', () => {
    expect(firstRunGuide([hook('codex', TODAY, true, '0.2.0')], [session('a', 'codex', TODAY)], null, NOW).step).toBe('update')
  })

  it('suggests starting a session when none runs today, and waits while one does', () => {
    const hooks = [hook('claude-code', YESTERDAY)]
    expect(firstRunGuide(hooks, [session('a', 'claude-code', YESTERDAY)], null, NOW).step).toBe('start')
    expect(firstRunGuide(hooks, [session('a', 'claude-code', TODAY, TODAY + 1)], null, NOW).step).toBe('start')
    expect(firstRunGuide(hooks, [session('a', 'claude-code', TODAY)], null, NOW).step).toBe('wait')
  })

  it('scoped to a session, names only its harness and says when it ended', () => {
    const hooks = [hook('claude-code', TODAY), hook('codex', TODAY, true)]
    const sessions = [session('cc', 'claude-code', TODAY), session('cx', 'codex', TODAY), session('old', 'claude-code', YESTERDAY, YESTERDAY)]
    expect(firstRunGuide(hooks, sessions, 'cc', NOW)).toMatchObject({ harnesses: [{ harness: 'claude-code' }], step: 'wait' })
    expect(firstRunGuide(hooks, sessions, 'cx', NOW).step).toBe('update')
    expect(firstRunGuide(hooks, sessions, 'old', NOW).step).toBe('ended')
  })
})

describe('stepCopy', () => {
  it('gives the setup and update commands to copy', () => {
    expect(stepCopy('setup', 'page').command).toBe('bunx gollabara setup')
    expect(stepCopy('update', 'stream').command).toBe('golla update')
    expect(stepCopy('wait', 'chat').title).not.toBe(stepCopy('wait', 'stream').title)
  })
})

describe('seenLabel', () => {
  it('shows the time today and the date before', () => {
    expect(seenLabel(TODAY, NOW)).toBe('09:30')
    expect(seenLabel(YESTERDAY, NOW)).toBe('10/15')
  })
})

describe('useHealth', () => {
  it('keeps the last answer and marks loaded even when the server fails', async () => {
    let ok = true
    const fetcher = (async () => ok ? Response.json({ version: '0.3.0', schema: 5, hooks: [] }) : new Response('', { status: 500 })) as unknown as typeof fetch
    const { health, loaded, refresh } = useHealth(fetcher)
    await refresh()
    expect([loaded.value, health.value?.version]).toEqual([true, '0.3.0'])
    ok = false
    await refresh()
    expect(health.value?.version).toBe('0.3.0')
  })
})
