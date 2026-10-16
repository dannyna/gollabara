import type { QuestionHold } from '../shared/types'
import { describe, expect, test } from 'bun:test'
import { Holds } from './holds'

const questions = [{ question: 'Which?', options: [{ label: 'A' }] }, { question: 'Why?', options: [] }]

function holds(ms = 1000) {
  const changes: [string, number | null][] = []
  const h = new Holds((hold: QuestionHold, live) => changes.push([hold.questionId, live ? hold.until : null]), ms, () => 1000)
  return { h, changes }
}

describe('question holds', () => {
  test('an answer to every held question ends the hold and goes to the hook, trimmed', async () => {
    const { h, changes } = holds()
    const held = h.hold('s', 'q1', questions, new AbortController().signal)
    expect(h.active()).toEqual([{ sessionId: 's', questionId: 'q1', until: 2000 }])
    expect(h.answer('s', 'q1', { 'Which?': ' A ', 'Why?': 'because' })).toEqual({ status: 'ok', answers: { 'Which?': 'A', 'Why?': 'because' } })
    expect(await held).toEqual({ 'Which?': 'A', 'Why?': 'because' })
    expect(changes).toEqual([['q1', 2000], ['q1', null]])
    // Answered once: the hold is gone
    expect(h.answer('s', 'q1', { 'Which?': 'A', 'Why?': 'x' })).toEqual({ status: 'closed' })
  })

  test('a partial, empty, unknown or overlong answer is refused and the hold stays', () => {
    const { h } = holds()
    void h.hold('s', 'q1', questions, new AbortController().signal)
    for (const answers of [{ 'Which?': 'A' }, { 'Which?': 'A', 'Why?': '  ' }, { 'Which?': 'A', 'Why?': 'x', 'Who?': 'y' }, { 'Which?': 'A', 'Why?': 'x'.repeat(2001) }, ['A'], null])
      expect(h.answer('s', 'q1', answers).status).toBe('invalid')
    expect(h.answer('other', 'q1', { 'Which?': 'A', 'Why?': 'x' })).toEqual({ status: 'closed' })
    expect(h.active()).toHaveLength(1)
  })

  test('the hold runs out, or ends when the hook goes away; a second hold for one question is refused', async () => {
    const { h, changes } = holds(30)
    const abort = new AbortController()
    const first = h.hold('s', 'q1', questions, abort.signal)
    expect(await h.hold('s', 'q1', questions, new AbortController().signal)).toBeNull()
    abort.abort()
    expect(await first).toBeNull()
    expect(await h.hold('s', 'q2', questions, new AbortController().signal)).toBeNull()
    expect(changes).toEqual([['q1', 1030], ['q1', null], ['q2', 1030], ['q2', null]])
    expect(h.active()).toEqual([])
  })
})
