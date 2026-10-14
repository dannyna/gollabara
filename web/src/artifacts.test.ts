import type { StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { splitSessionName, toArtifacts } from './artifacts'

const img = (url: string, at?: number) => ({ url, width: 100, height: 50, at })
function turn(id: number, sessionId: string, at: number, images: ReturnType<typeof img>[]): StreamMessage {
  return { id, at, sessionId, sessionName: `${sessionId} · feat/x`, kind: 'turn', images }
}

describe('toArtifacts', () => {
  it('lists images across turns in arrival order and marks session runs', () => {
    const out = toArtifacts([
      turn(1, 'a', 10, [img('a1', 10), img('a2', 30)]),
      turn(2, 'b', 20, [img('b1', 20)]),
    ])
    expect(out.map(a => a.url)).toEqual(['a1', 'b1', 'a2'])
    expect(out.map(a => a.sessionStart)).toEqual([true, true, true])
    expect(out.map(a => a.seq)).toEqual([1, 2, 3])
    expect(out[2]).toMatchObject({ key: '1-1', messageId: 1, session: 'a', branch: 'feat/x', at: 30 })
  })

  it('falls back to the message time for images stored before turns', () => {
    const out = toArtifacts([turn(1, 'a', 50, [img('old')]), turn(2, 'a', 60, [img('new', 40)])])
    expect(out.map(a => a.url)).toEqual(['new', 'old'])
    expect(out.map(a => a.sessionStart)).toEqual([true, false])
  })
})

describe('splitSessionName', () => {
  it('splits the branch off and leaves a bare directory alone', () => {
    expect(splitSessionName('piuda · desktop-shell')).toEqual({ session: 'piuda', branch: 'desktop-shell' })
    expect(splitSessionName('piuda')).toEqual({ session: 'piuda' })
  })
})
