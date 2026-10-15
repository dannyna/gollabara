// 64-bit difference hash (dHash), used only to group near-identical re-captures of one file.
// It is never shown and never used to judge an image. Pure-JS decoders, so no native build.

import type { Buffer } from 'node:buffer'
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'

interface Pixels {
  width: number
  height: number
  /** RGBA, 4 bytes per pixel */
  data: Uint8Array
}

function decode(bytes: Buffer, mime: string): Pixels | null {
  try {
    if (mime === 'image/png')
      return PNG.sync.read(bytes)
    if (mime === 'image/jpeg')
      return jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 256 })
  }
  catch {}
  // webp and gif have no pure decoder here; those stack by identical bytes only
  return null
}

/**
 * Box-averages the image down to a 9×8 grayscale grid and sets one bit per row neighbour
 * pair that gets brighter to the left. Returns 16 hex chars, or null when it cannot decode.
 */
export function dHash(bytes: Buffer, mime: string): string | null {
  const img = decode(bytes, mime)
  if (!img || !img.width || !img.height)
    return null
  const W = 9
  const H = 8
  const grid = new Float64Array(W * H)
  const count = new Float64Array(W * H)
  // Sample at most ~256 px per axis; plenty for a 9×8 average and fast on large screenshots
  const stepX = Math.max(1, Math.floor(img.width / 256))
  const stepY = Math.max(1, Math.floor(img.height / 256))
  for (let y = 0; y < img.height; y += stepY) {
    const gy = Math.min(H - 1, Math.floor(y * H / img.height))
    for (let x = 0; x < img.width; x += stepX) {
      const gx = Math.min(W - 1, Math.floor(x * W / img.width))
      const i = (y * img.width + x) * 4
      const a = img.data[i + 3]! / 255
      // Transparent pixels read as white, so a cut-out on alpha does not look black
      const lum = 0.299 * img.data[i]! + 0.587 * img.data[i + 1]! + 0.114 * img.data[i + 2]!
      grid[gy * W + gx]! += lum * a + 255 * (1 - a)
      count[gy * W + gx]! += 1
    }
  }
  let bits = 0n
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      const left = grid[y * W + x]! / (count[y * W + x]! || 1)
      const right = grid[y * W + x + 1]! / (count[y * W + x + 1]! || 1)
      bits = (bits << 1n) | (left > right ? 1n : 0n)
    }
  }
  return bits.toString(16).padStart(16, '0')
}
