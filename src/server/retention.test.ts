import { describe, expect, test } from 'bun:test'
import { pruneBefore } from './retention'

describe('pruneBefore', () => {
  test('a window in days gives its cutoff; forever and a window never chosen prune nothing', () => {
    const now = 10 * 86_400_000
    expect(pruneBefore('7', now)).toBe(3 * 86_400_000)
    expect(pruneBefore('30', now)).toBe(-20 * 86_400_000)
    expect(pruneBefore('forever', now)).toBeNull()
    expect(pruneBefore(undefined, now)).toBeNull()
  })
})
