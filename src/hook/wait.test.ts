import type { Feedback } from '../shared/types'
import type { PollResult } from './wait'
import { describe, expect, test } from 'bun:test'
import { waitForFeedback } from './wait'

const item: Feedback = { id: 1, sessionId: 's1', text: 'make it blue', createdAt: 0 }

/** Answers each poll from the list in turn, counting the polls and the time slept */
function scripted(results: PollResult[]) {
  const state = { polls: 0, slept: 0 }
  const poll = async () => results[Math.min(state.polls++, results.length - 1)]!
  const sleep = async (ms: number) => {
    state.slept += ms
  }
  return { state, poll, sleep }
}

describe('wake-up waiter', () => {
  test('polls through empty answers until feedback arrives', async () => {
    const { state, poll, sleep } = scripted([{ items: [] }, { items: [] }, { items: [item] }])
    expect(await waitForFeedback(poll, { deadline: Infinity, sleep })).toEqual([item])
    expect(state.polls).toBe(3)
  })

  test('stops quietly when the server says so (newer waiter, or the user took over)', async () => {
    const { state, poll, sleep } = scripted([{ items: [] }, 'stop', { items: [item] }])
    expect(await waitForFeedback(poll, { deadline: Infinity, sleep })).toBeNull()
    expect(state.polls).toBe(2)
  })

  test('rides out a short server restart, but gives up on one that stays down', async () => {
    const restart = scripted(['down', 'down', { items: [item] }])
    expect(await waitForFeedback(restart.poll, { deadline: Infinity, sleep: restart.sleep })).toEqual([item])
    const down = scripted(['down'])
    expect(await waitForFeedback(down.poll, { deadline: Infinity, sleep: down.sleep })).toBeNull()
    expect(down.state.polls).toBe(4)
  })

  test('starts no poll that could outlast the hook timeout', async () => {
    let now = 0
    const { state, poll, sleep } = scripted([{ items: [] }])
    const timed = async () => {
      now += 25_000
      return poll()
    }
    expect(await waitForFeedback(timed, { deadline: 100_000, now: () => now, sleep })).toBeNull()
    expect(state.polls).toBe(3)
  })

  test('stops once Claude Code is gone', async () => {
    const { state, poll, sleep } = scripted([{ items: [] }])
    let alive = true
    const once = async () => {
      alive = false
      return poll()
    }
    expect(await waitForFeedback(once, { deadline: Infinity, sleep, alive: () => alive })).toBeNull()
    expect(state.polls).toBe(1)
  })
})
