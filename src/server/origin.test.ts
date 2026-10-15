import type { NetworkInterfaceInfo } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { allowedHosts, refuseRequest } from './origin'

function nic(address: string): NetworkInterfaceInfo {
  return { address, family: address.includes(':') ? 'IPv6' : 'IPv4', internal: false, netmask: '', mac: '', cidr: null } as NetworkInterfaceInfo
}

const interfaces = { en0: [nic('192.168.0.138')], utun4: [nic('100.101.102.103')] }
const allowed = allowedHosts(['127.0.0.1', '100.101.102.103', 'fd7a:115c:a1e0::1234'], interfaces, 'Dannys-MBP.local', 'golla.home, other.lan')

function check(method: string, pathname: string, headers: Record<string, string>) {
  return refuseRequest({ method, pathname, headers: new Headers(headers) }, allowed)
}

const json = { 'content-type': 'application/json' }

describe('host allowlist', () => {
  test('loopback, bound addresses, this machine and GOLLABARA_ALLOWED_HOSTS pass with any port', () => {
    for (const host of ['localhost:4747', '127.0.0.1:4747', '[::1]:4747', 'localhost', '100.101.102.103:4747', '[fd7a:115c:a1e0::1234]:4747', 'dannys-mbp:4747', 'Dannys-MBP.local:4747', 'golla.home', 'other.lan:8080'])
      expect([host, check('GET', '/api/sessions', { host })]).toEqual([host, null])
  })

  test('a rebinding name gets 403, on the API, the page and the WebSocket', () => {
    for (const path of ['/api/sessions', '/', '/ws'])
      expect(check('GET', path, { host: 'evil.example:4747' })).toBe(403)
    expect(check('GET', '/api/sessions', {})).toBe(403)
    // An address the server did not bind is not this server's name either
    expect(check('GET', '/', { host: '192.168.0.138:4747' })).toBe(403)
  })

  test('Tailscale names pass', () => {
    expect(check('GET', '/', { host: 'dannys-mbp.tail1234.ts.net' })).toBeNull()
    expect(check('POST', '/api/feedback', { host: 'dannys-mbp.tail1234.ts.net', origin: 'https://dannys-mbp.tail1234.ts.net', ...json })).toBeNull()
  })

  test('a wildcard bind allows every interface address', () => {
    const open = allowedHosts(['0.0.0.0'], interfaces, 'mbp', undefined)
    expect(refuseRequest({ method: 'GET', pathname: '/', headers: new Headers({ host: '192.168.0.138:4747' }) }, open)).toBeNull()
  })
})

describe('origin and content type', () => {
  test('the hook and curl send no Origin and pass', () => {
    expect(check('POST', '/api/events', { host: '127.0.0.1:4747', ...json })).toBeNull()
    expect(check('POST', '/api/feedback/claim', { 'host': '127.0.0.1:4747', 'content-type': 'application/json; charset=utf-8' })).toBeNull()
  })

  test('a cross-origin POST gets 403, whatever its content type', () => {
    for (const type of ['text/plain', 'application/json'])
      expect(check('POST', '/api/feedback', { 'host': 'localhost:4747', 'origin': 'https://evil.example', 'content-type': type })).toBe(403)
    expect(check('POST', '/api/feedback', { host: 'localhost:4747', origin: 'null', ...json })).toBe(403)
    // Another tailnet's Funnel page is not this server
    expect(check('POST', '/api/feedback', { host: 'localhost:4747', origin: 'https://evil.tail9999.ts.net', ...json })).toBe(403)
  })

  test('Sec-Fetch-Site: cross-site gets 403 on mutations and the WebSocket', () => {
    expect(check('POST', '/api/feedback', { 'host': 'localhost:4747', 'sec-fetch-site': 'cross-site', ...json })).toBe(403)
    expect(check('GET', '/ws', { 'host': 'localhost:4747', 'origin': 'http://localhost:4747', 'sec-fetch-site': 'cross-site' })).toBe(403)
    expect(check('GET', '/img/a.png', { 'host': 'localhost:4747', 'sec-fetch-site': 'cross-site' })).toBeNull()
  })

  test('a WebSocket from another origin gets 403', () => {
    expect(check('GET', '/ws', { host: 'localhost:4747', origin: 'https://evil.example' })).toBe(403)
    expect(check('GET', '/ws', { host: '100.101.102.103:4747', origin: 'http://100.101.102.103:4747' })).toBeNull()
  })

  test('a text/plain or form POST to the API gets 415', () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x'])
      expect(check('POST', '/api/feedback', { 'host': '127.0.0.1:4747', 'content-type': type })).toBe(415)
    expect(check('PUT', '/api/settings', { host: '127.0.0.1:4747' })).toBe(415)
  })

  test('the vite dev proxy passes, with or without changeOrigin', () => {
    expect(check('POST', '/api/feedback', { 'host': 'localhost:4748', 'origin': 'http://localhost:4748', 'sec-fetch-site': 'same-origin', ...json })).toBeNull()
    expect(check('POST', '/api/feedback', { host: '127.0.0.1:4747', origin: 'http://localhost:4748', ...json })).toBeNull()
    expect(check('GET', '/ws', { host: 'localhost:4748', origin: 'http://localhost:4748' })).toBeNull()
  })
})
