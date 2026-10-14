import { describe, expect, it } from 'bun:test'
import { restoredFlag } from './useStream'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('restoredFlag', () => {
  it('stays off on the first connection', () => {
    const f = restoredFlag(20)
    f.opened()
    expect(f.restored.value).toBe(false)
  })

  it('turns on when a dropped connection opens again, then clears itself', async () => {
    const f = restoredFlag(20)
    f.opened()
    f.closed(true)
    // A retry that never connected keeps the earlier drop
    f.closed(false)
    f.opened()
    expect(f.restored.value).toBe(true)
    await wait(40)
    expect(f.restored.value).toBe(false)
  })

  it('clears at once when the connection drops again', () => {
    const f = restoredFlag(1000)
    f.opened()
    f.closed(true)
    f.opened()
    f.closed(true)
    expect(f.restored.value).toBe(false)
    f.dispose()
  })
})
