import type { StreamMessage } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { toArtifacts } from './artifacts'
import { arrivedSince, lastArrival } from './components/stream/follow'
import { fetchPage, helloRun, joinPage } from './history'

const msg = (id: number, at = id * 1000, extra: Partial<StreamMessage> = {}) => ({ id, at, sessionId: 'a', sessionName: 'a', kind: 'turn', ...extra }) as StreamMessage
const shot = (url: string, at: number) => ({ url, width: 4, height: 3, at })
const ids = (list: StreamMessage[]) => list.map(m => m.id)

describe('joinPage', () => {
  it('joins an older page before the run, keeping the loaded copy of a message it repeats', () => {
    const run = [msg(3, 3000, { text: 'loaded' }), msg(4)]
    const joined = joinPage(run, [msg(1), msg(2), msg(3, 3000, { text: 'page' })])
    expect(ids(joined)).toEqual([1, 2, 3, 4])
    expect(joined[2]!.text).toBe('loaded')
  })
})

describe('helloRun', () => {
  it('keeps older pages the run loaded when they meet the hello, and drops them across a gap', () => {
    const loaded = [msg(1), msg(2), msg(3), msg(4)]
    expect(helloRun(loaded, [msg(3), msg(4), msg(5)], true, false)).toEqual({ messages: [msg(1), msg(2), msg(3), msg(4), msg(5)], older: false })
    expect(helloRun(loaded, [msg(7), msg(8)], true, false)).toEqual({ messages: [msg(7), msg(8)], older: true })
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
  it('asks for the page before a message, and the page size', async () => {
    let asked = ''
    const fetcher = (async (url: string) => {
      asked = url
      return Response.json({ messages: [], triage: [], feedback: [], older: false })
    }) as unknown as typeof fetch
    await fetchPage(42, 200, fetcher)
    expect(asked).toBe('/api/history?limit=200&before=42')
  })

  it('says the server could not be reached in the UI\'s words', async () => {
    const fetcher = (async () => {
      throw new TypeError('network')
    }) as unknown as typeof fetch
    await expect(fetchPage(1, 10, fetcher)).rejects.toThrow('서버에 연결하지 못했어요')
  })
})
