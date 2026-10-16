import { describe, expect, test } from 'bun:test'
import { expiryCutoffs } from './expiry'

describe('expiryCutoffs', () => {
  test('an ended session keeps an hour, an unused cached verdict seven days', () => {
    const now = 10 * 86_400_000
    expect(expiryCutoffs(now)).toEqual({ endedBefore: now - 3_600_000, cacheBefore: now - 7 * 86_400_000 })
  })
})
