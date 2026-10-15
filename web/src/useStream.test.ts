import type { StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { connectionFlags, dedupe, retryDelay, upsert } from './useStream'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const msg = (id: number, text = `m${id}`) => ({ id, text }) as unknown as StreamMessage

describe('retryDelay', () => {
  it('doubles from half a second and stops at 4 s, so a restarted server is back within 5 s', () => {
    expect([0, 1, 2, 3, 4, 10, 50].map(retryDelay)).toEqual([500, 1000, 2000, 4000, 4000, 4000, 4000])
  })
})

describe('connectionFlags', () => {
  it('stays quiet on a connection that opens within the grace period', async () => {
    const f = connectionFlags(20, 20)
    f.closed()
    f.opened()
    await wait(40)
    expect(f.offline.value).toBe(false)
    expect(f.restored.value).toBe(false)
  })

  it('goes offline after the grace period, the first load included', async () => {
    const f = connectionFlags(20, 20)
    f.closed()
    // Failed retries keep the one grace timer running
    f.closed()
    expect(f.offline.value).toBe(false)
    await wait(40)
    expect(f.offline.value).toBe(true)
    f.dispose()
  })

  it('says restored only after an offline state was shown, then clears itself', async () => {
    const f = connectionFlags(10, 20)
    f.opened()
    f.closed()
    await wait(25)
    f.opened()
    expect(f.offline.value).toBe(false)
    expect(f.restored.value).toBe(true)
    await wait(40)
    expect(f.restored.value).toBe(false)
  })

  it('clears restored at once when the connection drops again', async () => {
    const f = connectionFlags(10, 1000)
    f.closed()
    await wait(25)
    f.opened()
    f.closed()
    expect(f.restored.value).toBe(false)
    f.dispose()
  })
})

describe('message merging', () => {
  it('replaces a known id in place and appends a new one', () => {
    const list = [msg(1), msg(2)]
    expect(upsert(list, msg(2, 'new')).map(m => [m.id, (m as unknown as { text: string }).text])).toEqual([[1, 'm1'], [2, 'new']])
    expect(upsert(list, msg(3)).map(m => m.id)).toEqual([1, 2, 3])
  })

  it('keeps one copy of each id, the latest', () => {
    const list = [msg(1), msg(2), msg(1, 'again')]
    expect(dedupe(list).map(m => [m.id, (m as unknown as { text: string }).text])).toEqual([[1, 'again'], [2, 'm2']])
    const clean = [msg(1), msg(2)]
    expect(dedupe(clean)).toBe(clean)
  })
})
