import type { Session, StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { endedSessions, filterSessions, goneMutes, inScope, muteChanges, toSessionRows } from './sessions'

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
      { id: 'a', session: 'a', lastSeenAt: 30, muted: false, ended: false },
      { id: 'old', session: 'old', branch: 'feat/x', lastSeenAt: 20, muted: true, ended: false },
      { id: 'b', session: 'b', lastSeenAt: 5, muted: false, ended: true },
    ])
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

describe('muted list cleanup', () => {
  it('finds muted ids whose session is gone from the server', () => {
    expect(goneMutes(new Set(['a', 'old', 'gone']), [session('a', 1)], [msg(1, 'old', 1)])).toEqual(['gone'])
  })

  it('reports a forgotten id as neither muted nor unmuted, so no 「음소거 해제」 line', () => {
    const prev = new Set(['a', 'gone'])
    expect(muteChanges(new Set(['b']), prev, new Set(['gone']))).toEqual({ muted: ['b'], unmuted: ['a'] })
  })
})
