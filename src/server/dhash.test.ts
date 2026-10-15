import { Buffer } from 'node:buffer'
import { describe, expect, test } from 'bun:test'
import { PNG } from 'pngjs'
import { dhashDistance } from '../shared/stacks'
import { dHash } from './dhash'

/** A 90×80 grayscale PNG from a pixel function */
function png(shade: (x: number, y: number) => number): Buffer {
  const img = new PNG({ width: 90, height: 80 })
  for (let y = 0; y < 80; y++) {
    for (let x = 0; x < 90; x++) {
      const i = (y * 90 + x) * 4
      img.data.fill(shade(x, y), i, i + 3)
      img.data[i + 3] = 255
    }
  }
  return PNG.sync.write(img)
}

describe('dHash', () => {
  const ramp = png(x => 250 - x * 2)

  test('the same picture hashes the same; a small touch stays close', () => {
    const touched = png((x, y) => (x > 80 && y > 70 ? 0 : 250 - x * 2))
    expect(dHash(ramp, 'image/png')).toBe(dHash(png(x => 250 - x * 2), 'image/png'))
    expect(dhashDistance(dHash(ramp, 'image/png')!, dHash(touched, 'image/png')!)).toBeLessThanOrEqual(2)
  })

  test('a different picture lands far away', () => {
    const flipped = png(x => 70 + x * 2)
    expect(dhashDistance(dHash(ramp, 'image/png')!, dHash(flipped, 'image/png')!)).toBeGreaterThan(30)
  })

  test('formats it cannot decode give no hash', () => {
    expect(dHash(Buffer.from('nope'), 'image/png')).toBeNull()
    expect(dHash(ramp, 'image/webp')).toBeNull()
  })
})
