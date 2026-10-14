// 칸 너비를 이미지 비율에 맞추려면 크기가 필요하다. hook 이 크기를 안 주면 헤더에서 읽는다.
import type { Buffer } from 'node:buffer'

export function imageSize(b: Buffer): { width: number, height: number } | null {
  // PNG: IHDR 의 width/height (big-endian)
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50)
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  // JPEG: SOFn 마커를 찾는다
  if (b.length > 4 && b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) {
        i++
        continue
      }
      const marker = b[i + 1]!
      const len = b.readUInt16BE(i + 2)
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC)
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
      i += 2 + len
    }
  }
  return null
}
