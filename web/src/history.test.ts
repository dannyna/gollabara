import type { StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { toArtifacts } from './artifacts'
import { arrivedSince, lastArrival } from './components/stream/follow'
import { behindCounts, DAY_MS, dayLoaded, fetchPage, helloRun, joinPage, routeFrame } from './history'

const msg = (id: number, at = id * 1000, extra: Partial<StreamMessage> = {}) => ({ id, at, sessionId: 'a', sessionName: 'a', kind: 'turn', ...extra }) as StreamMessage
const shot = (url: string, at: number, role?: 'reference') => ({ url, width: 4, height: 3, at, ...(role ? { role } : {}) })
const ids = (list: StreamMessage[]) => list.map(m => m.id)

describe('joinPage', () => {
  it('joins a page at the end it extends, keeping the loaded copy of a message it repeats', () => {
    const run = [msg(3), msg(4, 4000, { text: 'loaded' })]
    expect(ids(joinPage(run, [msg(1), msg(2)], 'older'))).toEqual([1, 2, 3, 4])
    const newer = joinPage(run, [msg(4, 4000, { text: 'page' }), msg(5)], 'newer')
    expect(ids(newer)).toEqual([3, 4, 5])
    expect(newer[1]!.text).toBe('loaded')
  })
})

describe('routeFrame', () => {
  it('lets live frames join a live run, and keeps them out of a run the reader jumped to', () => {
    const run = [msg(1), msg(2)]
    expect(routeFrame(run, true, msg(9))).toBe('run')
    expect(routeFrame(run, false, msg(9))).toBe('buffer')
    // A message already in the jumped-to run still changes in place
    expect(routeFrame(run, false, msg(2))).toBe('run')
  })

  it('counts what waits: messages, and artifact images but not references', () => {
    const buffer = new Map([[8, msg(8, 8000, { images: [shot('a', 1), shot('r', 2, 'reference')] })], [9, msg(9)]])
    expect(behindCounts(buffer)).toEqual({ messages: 2, artifacts: 1 })
  })
})

describe('helloRun', () => {
  it('keeps older pages a live run loaded when they meet the hello, and drops them across a gap', () => {
    const loaded = [msg(1), msg(2), msg(3), msg(4)]
    expect(helloRun(loaded, true, [msg(3), msg(4), msg(5)], true, false)).toEqual({ messages: [msg(1), msg(2), msg(3), msg(4), msg(5)], older: false })
    expect(helloRun(loaded, true, [msg(7), msg(8)], true, false)).toEqual({ messages: [msg(7), msg(8)], older: true })
  })

  it('leaves a run the reader jumped to as it is', () => {
    const run = [msg(1), msg(2)]
    expect(helloRun(run, false, [msg(9)], true, true)).toEqual({ messages: run, older: true })
  })
})

describe('dayLoaded', () => {
  const day = 10 * DAY_MS
  it('stays in the run only when it holds the day and nothing of that day is cut off before it', () => {
    const run = [msg(1, day - 5), msg(2, day + 5), msg(3, day + DAY_MS + 5)]
    expect(dayLoaded(run, true, day)).toBe(true)
    expect(dayLoaded(run.slice(1), true, day)).toBe(false)
    expect(dayLoaded(run.slice(1), false, day)).toBe(true)
    expect(dayLoaded(run, true, day - DAY_MS)).toBe(false)
  })
})

describe('arrivals after a page', () => {
  it('a page of older captures renumbers arrivals, which is why the rail counts again from the page', () => {
    const latest = [msg(5, 5000, { images: [shot('e', 5000)] }), msg(6, 6000, { images: [shot('f', 6000)] })]
    const seen = lastArrival(toArtifacts(latest))
    const paged = toArtifacts([msg(1, 1000, { images: [shot('a', 1000)] }), ...latest])
    expect(arrivedSince(seen, paged)).toBe(1)
    expect(arrivedSince(lastArrival(paged), paged)).toBe(0)
  })
})

describe('fetchPage', () => {
  it('asks for one cursor and the page size', async () => {
    let asked = ''
    const fetcher = (async (url: string) => {
      asked = url
      return Response.json({ messages: [], triage: [], feedback: [], older: false, newer: false })
    }) as unknown as typeof fetch
    await fetchPage({ before: 42 }, 200, fetcher)
    expect(asked).toBe('/api/history?limit=200&before=42')
  })

  it('says the server could not be reached in the UI\'s words', async () => {
    const fetcher = (async () => {
      throw new TypeError('network')
    }) as unknown as typeof fetch
    await expect(fetchPage({}, 10, fetcher)).rejects.toThrow('서버에 연결하지 못했어요')
  })
})
