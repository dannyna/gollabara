import type { NetworkInterfaceInfo } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { allowRequest, listenHosts } from './listen'

function nic(address: string, internal = false): NetworkInterfaceInfo {
  const family = address.includes(':') ? 'IPv6' : 'IPv4'
  return { address, family, internal, netmask: '', mac: '00:00:00:00:00:00', cidr: null, ...(family === 'IPv6' ? { scopeid: 0 } : {}) } as NetworkInterfaceInfo
}

const interfaces = {
  lo0: [nic('127.0.0.1', true), nic('::1', true)],
  en0: [nic('192.168.0.138'), nic('fe80::140c:395a:2f0c:911a')],
  utun4: [nic('100.101.102.103'), nic('fd7a:115c:a1e0::1234')],
  en8: [nic('169.254.110.182')],
}

describe('listen addresses', () => {
  test('loopback plus the Tailscale addresses, never the LAN', () => {
    expect(listenHosts(undefined, interfaces)).toEqual({ hosts: ['127.0.0.1', '100.101.102.103', 'fd7a:115c:a1e0::1234'], explicit: false })
  })

  test('loopback alone when Tailscale is down', () => {
    expect(listenHosts(undefined, { lo0: interfaces.lo0, en0: interfaces.en0 })).toEqual({ hosts: ['127.0.0.1'], explicit: false })
    expect(listenHosts('', {})).toEqual({ hosts: ['127.0.0.1'], explicit: false })
  })

  test('GOLLABARA_HOST replaces the defaults', () => {
    expect(listenHosts('0.0.0.0', interfaces)).toEqual({ hosts: ['0.0.0.0'], explicit: true })
    expect(listenHosts(' 127.0.0.1 , 192.168.0.138,,127.0.0.1', interfaces)).toEqual({ hosts: ['127.0.0.1', '192.168.0.138'], explicit: true })
  })
})

describe('request gate', () => {
  test('loopback and tailnet sources pass, LAN and unknown sources do not', () => {
    for (const addr of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '100.101.102.103', 'fd7a:115c:a1e0::1234'])
      expect([addr, allowRequest(addr, false)]).toEqual([addr, true])
    for (const addr of ['192.168.0.12', '::ffff:192.168.0.12', '10.0.0.5', null, undefined])
      expect([addr, allowRequest(addr, false)]).toEqual([addr, false])
  })

  test('an explicit GOLLABARA_HOST lets every source through', () => {
    expect(allowRequest('192.168.0.12', true)).toBe(true)
  })
})
