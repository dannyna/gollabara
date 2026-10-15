import type { Capture } from './stacks'
import { describe, expect, test } from 'bun:test'
import { basename, DHASH_MAX_DISTANCE, dhashDistance, middleTruncate, stackCaptures } from './stacks'

const base = 'ffffffff00000000'
/** A dHash `bits` bits away from `base` */
const near = (bits: number) => (BigInt(`0x${base}`) ^ ((1n << BigInt(bits)) - 1n)).toString(16).padStart(16, '0')

let n = 0
function shot(over: Partial<Capture> = {}): Capture {
  n++
  return { key: `k${n}`, sessionId: 's1', url: `/img/${n}.png`, width: 780, height: 1688, at: n * 1000, source: '/tmp/login.png', dhash: base, ...over }
}
const keys = (stacks: Capture[][]) => stacks.map(s => s.map(c => c.key))

describe('stackCaptures', () => {
  test('identical bytes stack even without a source', () => {
    const a = shot({ url: '/img/same.png', source: undefined, dhash: undefined })
    const b = shot({ url: '/img/same.png', source: undefined, dhash: undefined })
    expect(keys(stackCaptures([a, b]))).toEqual([[a.key, b.key]])
  })

  test('without a source, different bytes never stack, however alike', () => {
    const a = shot({ source: undefined })
    const b = shot({ source: undefined })
    expect(stackCaptures([a, b])).toHaveLength(2)
  })

  test(`same source and size stack up to ${DHASH_MAX_DISTANCE} bits apart, not beyond`, () => {
    const a = shot()
    const b = shot({ dhash: near(DHASH_MAX_DISTANCE) })
    const c = shot({ source: '/tmp/other.png' })
    expect(keys(stackCaptures([a, b]))).toEqual([[a.key, b.key]])
    expect(stackCaptures([a, shot({ dhash: near(DHASH_MAX_DISTANCE + 1) })])).toHaveLength(2)
    expect(stackCaptures([a, c])).toHaveLength(2)
  })

  test('a reused file name holding a different size or screen stays apart', () => {
    const a = shot()
    expect(stackCaptures([a, shot({ height: 1400 })])).toHaveLength(2)
    expect(stackCaptures([a, shot({ dhash: '00000000ffffffff' })])).toHaveLength(2)
    expect(stackCaptures([a, shot({ dhash: undefined })])).toHaveLength(2)
  })

  test('compares with the newest member, so a slow drift does not chain', () => {
    const a = shot()
    const b = shot({ dhash: near(5) })
    const c = shot({ dhash: near(10) })
    // c is 5 bits from b but 10 from a; it joins because b is the newest
    expect(keys(stackCaptures([a, b, c]))).toEqual([[a.key, b.key, c.key]])
    const far = shot({ dhash: near(20) })
    expect(stackCaptures([a, b, far])).toHaveLength(2)
  })

  test('sessions never share a stack', () => {
    const a = shot({ url: '/img/same.png' })
    const b = shot({ url: '/img/same.png', sessionId: 's2' })
    expect(stackCaptures([a, b])).toHaveLength(2)
  })

  test('stacks span turns and sit at their newest capture', () => {
    const a = shot()
    const other = shot({ source: '/tmp/home.png', dhash: '0f0f0f0f0f0f0f0f' })
    const again = shot({ at: 10 * 60 * 1000 })
    expect(keys(stackCaptures([again, other, a]))).toEqual([[other.key], [a.key, again.key]])
  })

  test('a split capture stands alone, and the stack it left keeps its other members', () => {
    const [a, b, c] = [shot(), shot(), shot()]
    expect(keys(stackCaptures([a, b, c], new Set([b.key])))).toEqual([[b.key], [a.key, c.key]])
  })
})

describe('names', () => {
  test('dhashDistance counts differing bits', () => {
    expect(dhashDistance(base, base)).toBe(0)
    expect(dhashDistance(base, near(6))).toBe(6)
    expect(dhashDistance('0000000000000000', 'ffffffffffffffff')).toBe(64)
  })

  test('basename drops the folders', () => {
    expect(basename('/tmp/sw-e2e/p2-01-login.png')).toBe('p2-01-login.png')
    expect(basename('shot.png')).toBe('shot.png')
    expect(basename('C:\\shots\\a.png')).toBe('a.png')
  })

  test('middleTruncate keeps the start and the extension', () => {
    expect(middleTruncate('r3-05-home.png')).toBe('r3-05-home.png')
    const short = middleTruncate('p2-03-ai-consent-after-scrolling-down.png', 24)
    expect([...short]).toHaveLength(24)
    expect(short.startsWith('p2-03-ai-con')).toBe(true)
    expect(short.endsWith('down.png')).toBe(true)
    expect(short).toContain('\u2026')
  })
})
