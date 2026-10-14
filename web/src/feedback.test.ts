import type { Feedback } from '../../src/shared/types'
import type { PendingSend } from './feedback'
import { describe, expect, it } from 'bun:test'
import { failureReason, feedbackBySession, FeedbackSendError, mergeFeedback, postFeedback, resolveTarget, toMyEntries } from './feedback'

function fb(id: number, sessionId: string, createdAt: number, deliveredAt?: number): Feedback {
  return {
    id,
    sessionId,
    text: `t${id}`,
    createdAt,
    ...(deliveredAt == null ? {} : { deliveredAt, deliveredVia: 'post-tool-use' as const }),
  }
}
const none = new Set<string>()

describe('resolveTarget', () => {
  it('prefers the attached image\'s session, then the scope, then the @ pick', () => {
    expect(resolveTarget({ attachment: 'img', scope: 'scope', mention: 'at', muted: none })).toBe('img')
    expect(resolveTarget({ scope: 'scope', mention: 'at', muted: none })).toBe('scope')
    expect(resolveTarget({ scope: null, mention: 'at', muted: none })).toBe('at')
    expect(resolveTarget({ muted: none })).toBeNull()
  })

  it('never targets a muted session, and a muted winner does not fall through', () => {
    expect(resolveTarget({ mention: 'at', muted: new Set(['at']) })).toBeNull()
    expect(resolveTarget({ attachment: 'img', mention: 'at', muted: new Set(['img']) })).toBeNull()
  })
})

describe('mergeFeedback', () => {
  it('adds new records in send order and moves queued to delivered by id', () => {
    let list = mergeFeedback([], fb(2, 'a', 200))
    list = mergeFeedback(list, fb(1, 'a', 100))
    expect(list.map(f => f.id)).toEqual([1, 2])
    list = mergeFeedback(list, fb(1, 'a', 100, 300))
    expect(list[0]!.deliveredAt).toBe(300)
    expect(list).toHaveLength(2)
  })

  it('keeps delivered when a late queued copy arrives (POST response after the claim)', () => {
    const list = mergeFeedback([fb(1, 'a', 100, 300)], fb(1, 'a', 100))
    expect(list[0]!.deliveredAt).toBe(300)
  })

  it('groups by session in send order', () => {
    const by = feedbackBySession([fb(1, 'a', 100), fb(2, 'b', 150), fb(3, 'a', 200)])
    expect(by.get('a')!.map(f => f.id)).toEqual([1, 3])
    expect(by.get('b')!.map(f => f.id)).toEqual([2])
  })
})

describe('toMyEntries', () => {
  const pending = (key: string, at: number, state: PendingSend['state']): PendingSend => ({ key, at, state, request: { sessionId: 'a', text: key } })

  it('leaves queued records to the tray and places delivered ones at their delivery time', () => {
    const entries = toMyEntries([fb(1, 'a', 100, 500), fb(2, 'a', 200), fb(3, 'b', 300, 400)], [pending('p-1', 450, 'failed')])
    expect(entries.map(e => [e.key, e.at])).toEqual([['f-3', 400], ['p-1', 450], ['f-1', 500]])
  })

  it('marks 전달됨 on each session\'s latest delivered bubble only', () => {
    const entries = toMyEntries([fb(1, 'a', 100, 200), fb(2, 'a', 150, 250), fb(3, 'b', 160, 210)], [])
    expect(Object.fromEntries(entries.map(e => [e.key, e.state]))).toEqual({ 'f-1': 'none', 'f-2': 'delivered', 'f-3': 'delivered' })
  })

  it('keeps unsent sends with their state', () => {
    const entries = toMyEntries([], [pending('p-1', 1, 'queued'), pending('p-2', 2, 'failed')])
    expect(entries.map(e => e.state)).toEqual(['queued', 'failed'])
  })

  it('quotes the image by its session and capture time', () => {
    const at = new Date(2026, 9, 14, 14, 34).getTime()
    const [entry] = toMyEntries([{ ...fb(1, 'a', 100, 200), image: { url: '/img/x.png', path: '/d/x.png', at, sessionName: 'od · hero' } }], [])
    expect(entry!.quote).toEqual({ text: 'od · 14:34', image: '/img/x.png' })
  })
})

describe('postFeedback', () => {
  it('returns the stored record', async () => {
    const saved = fb(7, 'a', 100)
    const fetcher = (async () => Response.json(saved)) as unknown as typeof fetch
    expect(await postFeedback({ sessionId: 'a', text: 'hi' }, fetcher)).toEqual(saved)
  })

  it('says why a 403 failed: only this Mac or the tailnet may send', async () => {
    const fetcher = (async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch
    const error = await postFeedback({ sessionId: 'a', text: 'hi' }, fetcher).catch(e => e)
    expect(error).toBeInstanceOf(FeedbackSendError)
    expect(failureReason(error)).toBe('이 Mac이나 tailnet에서만 보낼 수 있어요')
  })

  it('keeps the generic copy when the server was not reached', async () => {
    const fetcher = (async () => {
      throw new TypeError('offline')
    }) as unknown as typeof fetch
    expect(failureReason(await postFeedback({ sessionId: 'a', text: 'hi' }, fetcher).catch(e => e))).toBeUndefined()
  })
})
