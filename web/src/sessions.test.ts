import type { Session, StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { activityLabel, endedSessions, filterSessions, goneMutes, inScope, listedSessions, muteChanges, toSessionRows } from './sessions'

const msg = (id: number, sessionId: string, at: number): StreamMessage => ({ id, at, sessionId, sessionName: `${sessionId} · feat/x`, kind: 'turn' })
const session = (id: string, lastSeenAt: number): Session => ({ id, name: id, harness: 'claude-code', cwd: '/', startedAt: 0, lastSeenAt })

describe('inScope', () => {
  const messages = [msg(1, 'a', 1), msg(2, 'b', 2), msg(3, 'c', 3)]

  it('hides muted sessions from 전체 세션', () => {
    expect(inScope(messages, null, new Set(['b'])).map(m => m.id)).toEqual([1, 3])
  })

  it('keeps only the chosen session when scoped', () => {
    expect(inScope(messages, 'c', new Set()).map(m => m.id)).toEqual([3])
  })
})

describe('toSessionRows', () => {
  it('lists recorded and message-only sessions, most recent first, with mute and end marked', () => {
    const rows = toSessionRows([session('a', 10), { ...session('b', 5), endedAt: 6 }], [msg(1, 'a', 30), msg(2, 'old', 20)], new Set(['old']))
    expect(rows).toEqual([
      { id: 'a', session: 'a', lastSeenAt: 30, muted: false, ended: false, live: true, harness: 'claude-code' },
      { id: 'old', session: 'old', branch: 'feat/x', lastSeenAt: 20, muted: true, ended: false, live: false },
      { id: 'b', session: 'b', lastSeenAt: 5, muted: false, ended: true, live: false, harness: 'claude-code' },
    ])
  })

  it('carries a live session\'s state, never an ended one\'s', () => {
    const rows = toSessionRows([{ ...session('a', 2), harness: 'codex', state: 'waiting' }, { ...session('b', 1), state: 'working', endedAt: 3 }], [], new Set())
    expect(rows[0]).toMatchObject({ harness: 'codex', state: 'waiting' })
    expect(rows[1]).not.toHaveProperty('state')
  })

  it('lists only live sessions for an empty query', () => {
    const rows = toSessionRows([session('a', 10), { ...session('b', 5), endedAt: 6 }], [msg(1, 'old', 20)], new Set())
    expect(listedSessions(rows, '').map(r => r.id)).toEqual(['a'])
    expect(listedSessions(rows, '  ').map(r => r.id)).toEqual(['a'])
  })

  it('finds ended and message-only sessions by a query', () => {
    const rows = toSessionRows([session('web', 10), { ...session('piuda', 5), endedAt: 6 }], [msg(1, 'pixel', 20)], new Set())
    expect(listedSessions(rows, 'pi').map(r => r.id)).toEqual(['pixel', 'piuda'])
    expect(listedSessions(rows, 'piuda')[0]).toMatchObject({ ended: true, live: false })
  })

  it('filters rows by name or branch, ignoring case, and keeps them all for an empty filter', () => {
    const rows = toSessionRows([session('gollabara · feat/history', 3), session('Piuda', 2), session('api · main', 1)], [], new Set())
    expect(filterSessions(rows, ' PIU ').map(r => r.session)).toEqual(['Piuda'])
    expect(filterSessions(rows, 'history').map(r => r.session)).toEqual(['gollabara'])
    expect(filterSessions(rows, 'zzz')).toEqual([])
    expect(filterSessions(rows, '  ')).toBe(rows)
  })

  it('carries the hint of a colliding name, and finds a row by it', () => {
    const rows = toSessionRows([session('e2e-app', 2), session('e2e-app-2', 1)], [], new Set(), id => id === 'e2e-app' ? 'repo2/' : undefined)
    expect(rows[0]).toMatchObject({ session: 'e2e-app', hint: 'repo2/' })
    expect(rows[1]).not.toHaveProperty('hint')
    expect(filterSessions(rows, 'repo2/e2e').map(r => r.id)).toEqual(['e2e-app'])
  })

  it('collects the ended sessions', () => {
    expect([...endedSessions([session('a', 1), { ...session('b', 1), endedAt: 2 }])]).toEqual(['b'])
  })
})

describe('activityLabel', () => {
  const now = new Date(2026, 9, 14, 14, 30).getTime()
  const ago = (ms: number) => activityLabel(now - ms, now)

  it('reads 방금 under a minute, and for a clock a little ahead', () => {
    expect(ago(59_000)).toBe('방금')
    expect(ago(-5_000)).toBe('방금')
  })

  it('counts minutes under an hour, then hours while it is still today', () => {
    expect(ago(60_000)).toBe('1분 전')
    expect(ago(59 * 60_000 + 59_000)).toBe('59분 전')
    expect(ago(60 * 60_000)).toBe('1시간 전')
    expect(ago(14 * 60 * 60_000 + 29 * 60_000)).toBe('14시간 전')
  })

  it('says 어제 for the calendar day before, then the date', () => {
    expect(ago(14 * 60 * 60_000 + 31 * 60_000)).toBe('어제')
    expect(activityLabel(new Date(2026, 9, 13, 0, 0).getTime(), now)).toBe('어제')
    expect(activityLabel(new Date(2026, 9, 12, 23, 59).getTime(), now)).toBe('10/12')
  })
})

describe('muted list cleanup', () => {
  it('finds muted ids whose session is gone from the server', () => {
    expect(goneMutes(new Set(['a', 'old', 'gone']), [session('a', 1)], [msg(1, 'old', 1)])).toEqual(['gone'])
  })

  it('reports a forgotten id as neither muted nor unmuted, so no 「음소거 해제」 line', () => {
    const prev = new Set(['a', 'gone'])
    expect(muteChanges(new Set(['b']), prev, new Set(['gone']))).toEqual({ muted: ['b'], unmuted: ['a'] })
  })
})
