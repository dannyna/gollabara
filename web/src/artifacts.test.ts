import type { StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { artifactCaption, splitSessionName, toArtifacts } from './artifacts'

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

describe('toArtifacts with a view', () => {
  const messages = [
    turn(1, 'a', 10, [img('a1', 10)]),
    turn(2, 'b', 20, [img('b1', 20)]),
    turn(3, 'a', 30, [img('a2', 30)]),
  ]

  it('keeps every image\'s place in the stream when a session is hidden', () => {
    const out = toArtifacts(messages, messages.filter(m => m.sessionId !== 'b'))
    expect(out.map(a => a.url)).toEqual(['a1', 'a2'])
    expect(out.map(a => a.seq)).toEqual([1, 3])
  })

  it('draws dividers between visible neighbours only', () => {
    expect(toArtifacts(messages).map(a => a.sessionStart)).toEqual([true, true, true])
    expect(toArtifacts(messages, [messages[0]!, messages[2]!]).map(a => a.sessionStart)).toEqual([true, false])
  })

  it('starts a divider and a date on the first image of a new day', () => {
    const d1 = new Date(2026, 9, 13, 23, 50).getTime()
    const d2 = new Date(2026, 9, 14, 0, 10).getTime()
    const out = toArtifacts([turn(1, 'a', d1, [img('late', d1)]), turn(2, 'a', d2, [img('early', d2), img('next', d2 + 1)])])
    expect(out.map(a => a.dayStart)).toEqual([false, true, false])
    expect(out.map(a => a.sessionStart)).toEqual([true, true, false])
  })
})

describe('artifactCaption', () => {
  it('uses the name, or the image\'s place in its turn when there is none', () => {
    const [first, second] = toArtifacts([turn(1, 'a', 10, [img('x', 10), img('y', 11)])])
    expect(artifactCaption(second!)).toBe('2장째')
    expect(artifactCaption({ ...first!, label: 'screenshot' })).toBe('screenshot')
  })
})

describe('splitSessionName', () => {
  it('splits the branch off and leaves a bare directory alone', () => {
    expect(splitSessionName('piuda · desktop-shell')).toEqual({ session: 'piuda', branch: 'desktop-shell' })
    expect(splitSessionName('piuda')).toEqual({ session: 'piuda' })
  })
})
