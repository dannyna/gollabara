import type { Session, StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { inScope, toSessionRows } from './sessions'

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
  it('lists recorded and message-only sessions, most recent first, with mute marked', () => {
    const rows = toSessionRows([session('a', 10)], [msg(1, 'a', 30), msg(2, 'old', 20)], new Set(['old']))
    expect(rows).toEqual([
      { id: 'a', session: 'a', lastSeenAt: 30, muted: false },
      { id: 'old', session: 'old', branch: 'feat/x', lastSeenAt: 20, muted: true },
    ])
  })
})
