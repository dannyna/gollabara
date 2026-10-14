import { describe, expect, test } from 'bun:test'
import { isTrustedSource } from './trusted'

describe('feedback source check', () => {
  test('loopback and the tailnet are trusted, including IPv4-mapped IPv6', () => {
    for (const addr of ['127.0.0.1', '127.255.0.9', '::1', '0:0:0:0:0:0:0:1', '::1%lo0', '::ffff:127.0.0.1', '::ffff:7f00:1', '100.64.0.0', '100.127.255.255', '::ffff:100.64.0.1', 'fd7a:115c:a1e0::1', 'FD7A:115C:A1E0:AB12::53'])
      expect([addr, isTrustedSource(addr)]).toEqual([addr, true])
  })

  test('LAN, public, other ULA and malformed sources are not', () => {
    for (const addr of ['192.168.0.12', '10.0.0.5', '100.63.255.255', '100.128.0.0', '::ffff:192.168.0.12', '::2', 'fd7a:115c::1', 'fd7a:115c:a1e1::1', '1::ffff:127.0.0.1', '127.0.0.256', 'localhost', '', null, undefined])
      expect([addr, isTrustedSource(addr)]).toEqual([addr, false])
  })
})
