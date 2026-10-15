import { describe, expect, test } from 'bun:test'
import { activityAfter, ChannelLiveness } from './channel'

describe('wake-up liveness', () => {
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

describe('busy or idle (a wake-up claims only from an idle session)', () => {
  test('prompts, tool calls and questions mean a turn is running', () => {
    expect(activityAfter({ claim: 'user-prompt-submit', claimed: 0 })).toBe('busy')
    expect(activityAfter({ claim: 'post-tool-use', claimed: 0 })).toBe('busy')
    expect(activityAfter({ event: 'question' })).toBe('busy')
    expect(activityAfter({ event: 'image' })).toBe('busy')
  })

  test('a Stop ends the turn unless the feedback it claimed continues it', () => {
    expect(activityAfter({ claim: 'stop', claimed: 0 })).toBe('idle')
    expect(activityAfter({ claim: 'stop', claimed: 2 })).toBe('busy')
  })

  test('a wake-up starts a turn; an empty claim and a recap change nothing', () => {
    expect(activityAfter({ claim: 'rewake', claimed: 1 })).toBe('busy')
    expect(activityAfter({ claim: 'rewake', claimed: 0 })).toBeNull()
    expect(activityAfter({ event: 'recap' })).toBeNull()
  })

  test('a new or unseen session is idle, and SessionStart makes it idle', () => {
    const live = new ChannelLiveness()
    expect(live.isIdle('s1')).toBe(true)
    live.observe('s1', { claim: 'post-tool-use', claimed: 0 })
    expect(live.isIdle('s1')).toBe(false)
    live.observe('s1', { event: 'session' })
    expect(live.isIdle('s1')).toBe(true)
  })

  test('a compaction mid-turn keeps the session busy, while resume and clear make it idle', () => {
    expect(activityAfter({ event: 'session', reason: 'compact' })).toBeNull()
    for (const reason of ['startup', 'resume', 'clear'] as const)
      expect(activityAfter({ event: 'session', reason })).toBe('idle')
    const live = new ChannelLiveness()
    live.observe('s1', { claim: 'post-tool-use', claimed: 0 })
    live.observe('s1', { event: 'session', reason: 'compact' })
    expect(live.isIdle('s1')).toBe(false)
  })

  test('a session turning idle wakes its waiting poll; staying busy does not', async () => {
    const live = new ChannelLiveness()
    live.observe('s1', { claim: 'user-prompt-submit', claimed: 0 })
    let woke = false
    const waiting = live.wait('s1', 60_000).then(() => (woke = true))
    live.observe('s1', { claim: 'post-tool-use', claimed: 0 })
    live.observe('s1', { claim: 'stop', claimed: 1 })
    await Bun.sleep(5)
    expect(woke).toBe(false)
    live.observe('s1', { claim: 'stop', claimed: 0 })
    await waiting
    expect(live.isIdle('s1')).toBe(true)
  })
})

describe('wake-up waiters (one per session, stepping aside once the user takes over)', () => {
  test('a newer waiter replaces the older one, whose open poll returns', async () => {
    const live = new ChannelLiveness()
    live.enlist('s1', 100)
    let woke = false
    const waiting = live.wait('s1', 60_000).then(() => (woke = true))
    live.enlist('s1', 100)
    await Bun.sleep(5)
    expect(woke).toBe(false)
    live.enlist('s1', 200)
    await waiting
    expect(live.retired('s1', 100)).toBe('replaced')
    expect(live.retired('s1', 200)).toBeNull()
    // The older waiter polling again does not take over
    live.enlist('s1', 100)
    expect(live.retired('s1', 200)).toBeNull()
  })

  test('a turn starting retires the waiter and wakes its poll', async () => {
    const live = new ChannelLiveness()
    live.enlist('s1', 1)
    const waiting = live.wait('s1', 60_000)
    live.observe('s1', { claim: 'user-prompt-submit', claimed: 0 })
    await waiting
    expect(live.retired('s1', 1)).toBe('busy')
  })

  test('a compaction neither wakes nor retires the waiter', async () => {
    const live = new ChannelLiveness()
    live.enlist('s1', 1)
    let woke = false
    const waiting = live.wait('s1', 60_000).then(() => (woke = true))
    live.observe('s1', { event: 'session', reason: 'compact' })
    await Bun.sleep(5)
    expect(woke).toBe(false)
    expect(live.retired('s1', 1)).toBeNull()
    live.wake('s1')
    await waiting
  })

  test('a waiter that starts before its Stop reaches the server keeps waiting', () => {
    const live = new ChannelLiveness()
    live.observe('s1', { claim: 'post-tool-use', claimed: 0 })
    live.enlist('s1', 1)
    live.observe('s1', { claim: 'stop', claimed: 0 })
    expect(live.isIdle('s1')).toBe(true)
    expect(live.retired('s1', 1)).toBeNull()
  })
})
