import type { PushEnv } from './push'
import { describe, expect, it } from 'bun:test'
import { pushState } from './push'

const env = (over: Partial<PushEnv>): PushEnv => ({ supported: true, ios: false, standalone: false, permission: 'default', subscribed: false, ...over })

describe('pushState', () => {
  it('is off until this device subscribed with permission granted', () => {
    expect(pushState(env({}))).toBe('off')
    expect(pushState(env({ permission: 'granted' }))).toBe('off')
    expect(pushState(env({ permission: 'granted', subscribed: true }))).toBe('on')
  })

  it('says when the browser blocked notifications or has no push', () => {
    expect(pushState(env({ permission: 'denied', subscribed: true }))).toBe('denied')
    expect(pushState(env({ supported: false }))).toBe('unsupported')
  })

  it('on iOS, points to the home-screen app instead', () => {
    expect(pushState(env({ ios: true, supported: false }))).toBe('ios-browser')
    expect(pushState(env({ ios: true, standalone: true, permission: 'granted', subscribed: true }))).toBe('on')
  })
})
