import { describe, expect, test } from 'bun:test'
import { ChannelLiveness } from './channel'

describe('channel liveness', () => {
  test('live while a poll is open and for the grace period after the last one ends', () => {
    const live = new ChannelLiveness(30_000)
    expect(live.isLive('s1', 0)).toBe(false)
    live.begin('s1', 0)
    expect(live.isLive('s1', 100_000)).toBe(true)
    live.end('s1', 100_000)
    expect(live.isLive('s1', 129_999)).toBe(true)
    expect(live.isLive('s1', 130_000)).toBe(false)
    expect(live.isLive('s2', 100_000)).toBe(false)
  })

  test('two overlapping polls keep it open until both end', () => {
    const live = new ChannelLiveness(0)
    live.begin('s1', 0)
    live.begin('s1', 0)
    live.end('s1', 1)
    expect(live.isLive('s1', 5)).toBe(true)
    live.end('s1', 5)
    expect(live.isLive('s1', 5)).toBe(false)
  })

  test('a wait returns when feedback wakes its session, and only that session', async () => {
    const live = new ChannelLiveness()
    let woke = false
    const waiting = live.wait('s1', 60_000).then(() => (woke = true))
    live.wake('s2')
    await Bun.sleep(5)
    expect(woke).toBe(false)
    live.wake('s1')
    await waiting
    expect(woke).toBe(true)
  })

  test('a wait also returns on timeout or when the client goes away', async () => {
    const live = new ChannelLiveness()
    await live.wait('s1', 5)
    const abort = new AbortController()
    const waiting = live.wait('s1', 60_000, abort.signal)
    abort.abort()
    await waiting
    await live.wait('s1', 60_000, abort.signal)
  })
})
