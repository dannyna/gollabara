import type { Feedback, Harness, Session } from '../../src/shared/types'
import type { PendingSend } from './feedback'
import { describe, expect, it } from 'bun:test'
import { routesFor } from '../../src/shared/routes'
import { discardFeedback, failureReason, feedbackBySession, FeedbackSendError, mergeFeedback, postFeedback, queueNote, resolveTarget, routeNote, sessionRouteNote, toMyEntries, toQueueGroups, withoutRemoved } from './feedback'

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

  it('says the session ended when the server refuses with 409', async () => {
    const fetcher = (async () => new Response('session ended', { status: 409 })) as unknown as typeof fetch
    expect(failureReason(await postFeedback({ sessionId: 'a', text: 'hi' }, fetcher).catch(e => e))).toBe('끝난 세션이에요')
  })

  it('keeps the generic copy when the server was not reached', async () => {
    const fetcher = (async () => {
      throw new TypeError('offline')
    }) as unknown as typeof fetch
    expect(failureReason(await postFeedback({ sessionId: 'a', text: 'hi' }, fetcher).catch(e => e))).toBeUndefined()
  })
})

describe('toQueueGroups', () => {
  const s = (id: string, name: string, endedAt?: number): Session => ({ id, name, harness: 'codex', cwd: '/', startedAt: 0, lastSeenAt: 0, ...(endedAt ? { endedAt } : {}) })
  const short = (id: string) => id === 'x' ? 'web' : id === 'y' ? 'web' : id

  it('keeps two sessions with the same short name apart, and marks an ended one', () => {
    const groups = toQueueGroups([fb(1, 'x', 1), fb(2, 'y', 2), fb(3, 'x', 3), fb(4, 'x', 0, 4)], [s('x', 'web · a'), s('y', 'web · b', 9)], false, short)
    expect(groups).toEqual([
      { id: 'x', session: 'web', items: [{ id: 1, text: 't1' }, { id: 3, text: 't3' }] },
      { id: 'y', session: 'web', items: [{ id: 2, text: 't2' }], status: '끝나서 전달할 수 없어요', ended: true },
    ])
  })
})

describe('withoutRemoved', () => {
  it('drops kept POST responses for items the stream removed, and nothing else', () => {
    const confirmed = [fb(1, 'a', 1), fb(2, 'a', 2)]
    expect(withoutRemoved(confirmed, [fb(1, 'a', 1), fb(3, 'a', 3)], [fb(3, 'a', 3)])).toEqual([fb(2, 'a', 2)])
    expect(withoutRemoved(confirmed, [fb(1, 'a', 1)], [fb(1, 'a', 1), fb(2, 'a', 2)])).toBe(confirmed)
  })
})

describe('discardFeedback', () => {
  it('sends the ids and returns what the server removed', async () => {
    let body: unknown
    const fetcher = (async (_: string, init: RequestInit) => {
      body = JSON.parse(init.body as string)
      return Response.json({ ok: true, feedbackIds: [4] })
    }) as unknown as typeof fetch
    expect(await discardFeedback('a', [4], fetcher)).toEqual([4])
    expect(body).toEqual({ sessionId: 'a', ids: [4] })
  })

  it('says why a 403 failed', async () => {
    const fetcher = (async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch
    expect((await discardFeedback('a', [4], fetcher).catch(e => e)).message).toBe('이 Mac이나 tailnet에서만 지울 수 있어요')
  })
})

describe('queueNote', () => {
  const s = (id: string, harness: Harness, live = false): Session =>
    ({ id, name: id, harness, cwd: '/', startedAt: 0, lastSeenAt: 0, routes: routesFor(harness, live) })

  it('says 「바로」 only when every waiting session has a live wake-up hook', () => {
    const sessions = [s('a', 'claude-code', true), s('b', 'claude-code', true)]
    expect(queueNote(['a'], sessions)).toEqual({ note: '바로 전달돼요', mixed: false })
    expect(queueNote(['a', 'b'], sessions)).toEqual({ note: '바로 전달돼요', mixed: false })
  })

  it('states a Codex session\'s real route, the same as Claude Code without a waiter', () => {
    const sessions = [s('cx', 'codex'), s('cc', 'claude-code')]
    expect(queueNote(['cx'], sessions)).toEqual({ note: '세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요', mixed: false })
    expect(queueNote(['cx', 'cc'], sessions)).toEqual({ note: '세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요', mixed: false })
  })

  it('says the sessions differ when they do, and each keeps its own note', () => {
    const sessions = [s('a', 'claude-code', true), s('cx', 'codex')]
    expect(queueNote(['a', 'cx'], sessions)).toEqual({ note: '세션마다 전달 시점이 달라요', mixed: true })
    expect(sessionRouteNote('a', sessions)).toBe('바로 전달돼요')
    expect(sessionRouteNote('cx', sessions)).toBe('세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요')
  })

  it('says an ended session cannot get it, whatever its routes said', () => {
    const ended = { ...s('gone', 'claude-code', true), endedAt: 5 }
    expect(queueNote(['gone'], [ended])).toEqual({ note: '끝난 세션이라 전달할 수 없어요', mixed: false })
    expect(queueNote(['gone', 'cx'], [ended, s('cx', 'codex')])).toEqual({ note: '세션마다 전달 시점이 달라요', mixed: true })
  })

  it('falls back for unknown sessions and servers from before routes', () => {
    const legacy: Session = { id: 'old', name: 'old', harness: 'claude-code', cwd: '/', startedAt: 0, lastSeenAt: 0, channel: true }
    expect(queueNote(['gone'], [])).toEqual({ note: '세션이 다음 작업을 할 때 전달돼요', mixed: false })
    expect(sessionRouteNote('old', [legacy])).toBe('바로 전달돼요')
    expect(routeNote([])).toBe('세션이 다음 작업을 할 때 전달돼요')
  })
})

describe('routesFor', () => {
  it('gives idle wake only to Claude Code sessions with a live waiter', () => {
    expect(routesFor('claude-code', true)).toEqual(['next-tool', 'next-prompt', 'turn-end', 'idle-wake'])
    expect(routesFor('open-design', true)).toContain('idle-wake')
    expect(routesFor('claude-code', false)).toEqual(['next-tool', 'next-prompt', 'turn-end'])
    expect(routesFor('codex', true)).toEqual(['next-tool', 'next-prompt', 'turn-end'])
  })
})
