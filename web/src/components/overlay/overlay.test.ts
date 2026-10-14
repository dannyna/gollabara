import { describe, expect, it } from 'bun:test'
import { validateSettings } from '../../settings'
import { setZoom, zoomLabel } from './zoom'

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
