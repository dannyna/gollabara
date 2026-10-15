import type { StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { artifactCaption, atVersion, cellKeys, referenceFolds, RUN_GAP_MS, sourceName, splitSessionName, toArtifacts, versionsHint } from './artifacts'

const img = (url: string, at?: number) => ({ url, width: 100, height: 50, at })
function turn(id: number, sessionId: string, at: number, images: NonNullable<StreamMessage['images']>): StreamMessage {
  return { id, at, sessionId, sessionName: `${sessionId} · feat/x`, kind: 'turn', images }
}

describe('toArtifacts', () => {
  it('lists images across turns in arrival order and marks session runs', () => {
    const out = toArtifacts([
      turn(1, 'a', 10, [img('a1', 10), img('a2', 30)]),
      turn(2, 'b', 20, [img('b1', 20)]),
    ])
    expect(out.map(a => a.url)).toEqual(['a1', 'b1', 'a2'])
    expect(out.map(a => a.runStart)).toEqual([true, true, true])
    expect(out.map(a => a.seq)).toEqual([1, 2, 3])
    expect(out[2]).toMatchObject({ key: '1-1', messageId: 1, session: 'a', branch: 'feat/x', at: 30 })
  })

  it('falls back to the message time for images stored before turns', () => {
    const out = toArtifacts([turn(1, 'a', 50, [img('old')]), turn(2, 'a', 60, [img('new', 40)])])
    expect(out.map(a => a.url)).toEqual(['new', 'old'])
    expect(out.map(a => a.runStart)).toEqual([true, false])
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
    expect(toArtifacts(messages).map(a => a.runStart)).toEqual([true, true, true])
    expect(toArtifacts(messages, [messages[0]!, messages[2]!]).map(a => a.runStart)).toEqual([true, false])
  })

  it('starts a divider and a date on the first image of a new day', () => {
    const d1 = new Date(2026, 9, 13, 23, 50).getTime()
    const d2 = new Date(2026, 9, 14, 0, 10).getTime()
    const out = toArtifacts([turn(1, 'a', d1, [img('late', d1)]), turn(2, 'a', d2, [img('early', d2), img('next', d2 + 1)])])
    expect(out.map(a => a.dayStart)).toEqual([false, true, false])
    expect(out.map(a => a.runStart)).toEqual([true, true, false])
  })
})

describe('runs', () => {
  it('a session\'s cells form one run until a gap of more than RUN_GAP_MS', () => {
    const t = (n: number) => n * 60_000
    const out = toArtifacts([turn(1, 'a', t(0), [img('a1', t(0)), img('a2', t(4)), img('a3', t(9)), img('a4', t(9) + RUN_GAP_MS + 1)])])
    expect(out.map(a => a.runStart)).toEqual([true, false, false, true])
  })
})

describe('hidden duplicates', () => {
  const shot = (url: string, at: number, source?: string, dhash = 'ffffffff00000000') => ({ url, width: 100, height: 50, at, ...(source ? { source, dhash } : {}) })
  const messages: StreamMessage[] = [
    turn(1, 'a', 10, [shot('login1', 10, '/tmp/login.png'), shot('home', 20, '/tmp/home.png', '0f0f0f0f0f0f0f0f')]),
    turn(2, 'b', 25, [shot('other', 25)]),
    // Ten minutes later, another turn re-shoots the login screen
    turn(3, 'a', 600_010, [shot('login2', 600_010, '/tmp/login.png')]),
  ]

  it('shows only the newest capture of a screen, at its place, with the older ones as versions', () => {
    const out = toArtifacts(messages)
    expect(out.map(a => a.url)).toEqual(['home', 'other', 'login2'])
    expect(out[2]).toMatchObject({ key: '1-0', messageId: 3, source: '/tmp/login.png', seq: 3, arrival: 4 })
    expect(out[2]!.versions!.map(v => v.url)).toEqual(['login1', 'login2'])
    expect(versionsHint(out[2]!)).toBe('같은 화면 2장')
    expect(sourceName(out[2]!)).toBe('login.png')
    expect(out[0]).not.toHaveProperty('versions')
  })

  it('numbers cells, not captures, and the new capture counts as one arrival', () => {
    const before = toArtifacts(messages.slice(0, 2))
    const after = toArtifacts(messages)
    expect(before.map(a => a.seq)).toEqual([1, 2, 3])
    expect(after.map(a => a.seq)).toEqual([1, 2, 3])
    expect(after.filter(a => a.arrival > Math.max(...before.map(b => b.arrival)))).toHaveLength(1)
  })

  it('identical bytes without a source hide too', () => {
    const out = toArtifacts([turn(1, 'a', 10, [img('same', 10), img('same', 20)])])
    expect(out).toHaveLength(1)
    expect(out[0]!.versions).toHaveLength(2)
  })

  it('a split capture gets its own cell, and every capture maps to its cell', () => {
    const out = toArtifacts(messages, messages, new Set(['1-0']))
    expect(out.map(a => a.key)).toEqual(['1-0', '1-1', '2-0', '3-0'])
    expect(out.every(a => !a.versions)).toBe(true)
    const joined = toArtifacts(messages)
    expect(cellKeys(joined).get('3-0')).toBe('1-0')
    expect(atVersion(joined[2]!, joined[2]!.versions![0]!)).toMatchObject({ key: '1-0', url: 'login1', at: 10, messageId: 1 })
  })
})

describe('references', () => {
  const ref = (url: string, at: number, source?: string) => ({ url, width: 100, height: 50, at, role: 'reference' as const, ...(source ? { source, dhash: 'ffffffff00000000' } : {}) })
  const messages: StreamMessage[] = [
    turn(1, 'a', 10, [ref('mock', 10, '/d/mock.png'), img('shot1', 20), ref('asset', 30)]),
    turn(2, 'a', 40, [ref('mock-again', 40, '/d/mock.png'), img('shot2', 50)]),
  ]

  it('never take a number or an arrival, and stored images without a role stay artifacts', () => {
    const out = toArtifacts(messages)
    expect(out.map(a => [a.url, a.key, a.seq, a.arrival])).toEqual([['shot1', '1-1', 1, 1], ['shot2', '2-1', 2, 2]])
    expect(out.every(a => a.role === undefined)).toBe(true)
    // shot1 follows a reference in its turn, yet is the turn's first artifact
    expect(artifactCaption(out[0]!)).toBe('1장째')
  })

  it('are listed on their own, stacked only among themselves', () => {
    const refs = toArtifacts(messages, messages, new Set(), 'reference')
    expect(refs.map(r => [r.url, r.role])).toEqual([['asset', 'reference'], ['mock-again', 'reference']])
    expect(refs[1]!.versions!.map(v => v.key)).toEqual(['1-0', '2-0'])
  })

  it('a reference re-read of an artifact file never joins or moves the artifact\'s cell', () => {
    const shot = { url: 'same', width: 100, height: 50, source: '/tmp/s.png', dhash: 'ffffffff00000000' }
    const list = [turn(1, 'a', 10, [{ ...shot, at: 10 }, img('next', 20)]), turn(2, 'a', 30, [{ ...shot, at: 30, role: 'reference' as const }])]
    expect(toArtifacts(list).map(a => [a.url, a.versions])).toEqual([['same', undefined], ['next', undefined]])
    expect(toArtifacts(list, list, new Set(), 'reference').map(r => r.key)).toEqual(['2-0'])
  })

  it('fold between the artifact cells they arrived between, keyed by their first reference', () => {
    const artifacts = toArtifacts(messages)
    const refs = toArtifacts(messages, messages, new Set(), 'reference')
    const lead = toArtifacts([turn(3, 'b', 5, [ref('first', 5)])], undefined, undefined, 'reference')
    expect(referenceFolds(artifacts, [...lead, ...refs]).map(f => [f.key, f.after, f.items.map(i => i.url)])).toEqual([
      ['3-0', null, ['first']],
      ['1-2', '1-1', ['asset', 'mock-again']],
    ])
    expect(referenceFolds(artifacts, [])).toEqual([])
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
