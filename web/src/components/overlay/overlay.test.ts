import { describe, expect, it } from 'bun:test'
import { legacySettings, sheetSettings, shortensRetention, validateSettings } from '../../settings'
import { clampPan, setZoom, wheelZoom, zoomAt, zoomLabel } from './zoom'

describe('setZoom', () => {
  it('clamps between 100% and 400%', () => {
    expect(setZoom({ zoom: 1, x: 0, y: 0 }, 9).zoom).toBe(4)
    expect(setZoom({ zoom: 2, x: 0, y: 0 }, 0.2).zoom).toBe(1)
  })

  it('keeps the pan while zoomed and resets it back at 100%', () => {
    expect(setZoom({ zoom: 2, x: 30, y: -10 }, 2.5)).toEqual({ zoom: 2.5, x: 30, y: -10 })
    expect(setZoom({ zoom: 2, x: 30, y: -10 }, 1)).toEqual({ zoom: 1, x: 0, y: 0 })
    expect(zoomLabel(1.5)).toBe('150%')
  })
})

describe('validateSettings', () => {
  it('asks for https on the phone address and a URL for the server', () => {
    expect(validateSettings({ server: 'http://127.0.0.1:4747', phone: '', retention: '30' })).toEqual({})
    expect(validateSettings({ server: 'nope', phone: 'http://my-mac.ts.net', retention: '7' })).toEqual({
      server: 'http:// 또는 https://로 시작하는 주소를 입력하세요',
      phone: '폰용 주소는 https://로 시작해야 해요',
    })
  })
})

describe('server settings', () => {
  it('reads an unset retention as 「계속 보관」, which is what the server does with it', () => {
    expect(sheetSettings('http://127.0.0.1:4747', { triage: 'off' })).toEqual({ server: 'http://127.0.0.1:4747', phone: '', retention: 'forever' })
  })

  it('asks before a shorter window only', () => {
    expect(shortensRetention('forever', '30')).toBe(true)
    expect(shortensRetention('30', '7')).toBe(true)
    expect(shortensRetention('7', 'forever')).toBe(false)
    expect(shortensRetention('30', '30')).toBe(false)
  })

  it('seeds the server with what this browser kept; a window that deletes waits for a confirm', () => {
    expect(legacySettings({ server: 'http://a', phone: 'https://mac.ts.net', retention: '7' })).toEqual({ seed: { phone: 'https://mac.ts.net', seed: true }, confirm: '7' })
    expect(legacySettings({ retention: 'forever' })).toEqual({ seed: { retention: 'forever', seed: true }, confirm: null })
    expect(legacySettings({ server: 'http://a' })).toEqual({ seed: null, confirm: null })
  })
})

describe('wheel zoom and pan', () => {
  it('keeps the point under the pointer in place', () => {
    const next = zoomAt({ zoom: 1, x: 0, y: 0 }, 2, 100, -50)
    expect(next).toEqual({ zoom: 2, x: -100, y: 50 })
    // The image point under the pointer: (c - x) / zoom stays the same
    expect((100 - next.x) / next.zoom).toBe(100)
  })
  it('recentres when zooming back out to 100%', () => {
    expect(zoomAt({ zoom: 2, x: -100, y: 50 }, 0.5, 10, 10)).toEqual({ zoom: 1, x: 0, y: 0 })
  })
  it('zooms in on scroll up and out on scroll down', () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1)
    expect(wheelZoom(2, 100)).toBeLessThan(2)
  })
  it('stops the image edges at the stage edges', () => {
    // 400 × 800 image at 200% in a 600 × 600 stage: 100px of travel sideways, 500 up/down
    expect(clampPan({ zoom: 2, x: 300, y: -900 }, 400, 800, 600, 600)).toEqual({ zoom: 2, x: 100, y: -500 })
    // Smaller than the stage on an axis: no travel on it
    expect(clampPan({ zoom: 1.2, x: 40, y: 0 }, 400, 800, 600, 600).x).toBe(0)
  })
})
