// Who may push feedback into sessions: this machine and the tailnet, never the LAN.
// Feedback becomes text a running session reads, so the source address is the gate.

/** Loopback (127.0.0.0/8, ::1) or Tailscale (100.64.0.0/10, fd7a:115c:a1e0::/48). IPv4-mapped IPv6 counts as IPv4. */
export function isTrustedSource(address: string | null | undefined): boolean {
  if (!address)
    return false
  const addr = address.toLowerCase().replace(/%.*$/, '')
  const dotted = addr.match(/^(.*:)?(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const octets = dotted[2]!.split('.').map(Number)
    if (octets.some(o => o > 255))
      return false
    // A dotted tail inside IPv6 only counts as IPv4 in the ::ffff:a.b.c.d mapped form
    if (dotted[1]) {
      const groups = expandV6(`${dotted[1]}0:0`)
      if (!groups || !isMapped(groups))
        return false
    }
    return isTrustedV4(octets[0]!, octets[1]!)
  }
  const groups = expandV6(addr)
  if (!groups)
    return false
  if (isMapped(groups))
    return isTrustedV4(groups[6]! >> 8, groups[6]! & 0xFF)
  if (groups.slice(0, 7).every(g => g === 0) && groups[7] === 1)
    return true
  return groups[0] === 0xFD7A && groups[1] === 0x115C && groups[2] === 0xA1E0
}

function isTrustedV4(a: number, b: number): boolean {
  return a === 127 || (a === 100 && b >= 64 && b <= 127)
}

/** ::ffff:0:0/96 */
function isMapped(groups: number[]): boolean {
  return groups.slice(0, 5).every(g => g === 0) && groups[5] === 0xFFFF
}

/** Eight 16-bit groups, or null if this is not an IPv6 address */
function expandV6(addr: string): number[] | null {
  if (!/^[\da-f:]+$/.test(addr) || addr.split('::').length > 2)
    return null
  const [head, tail] = addr.includes('::') ? addr.split('::') as [string, string] : [addr, null]
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const fill = tail === null ? 0 : 8 - left.length - right.length
  if (fill < 0 || (tail === null && left.length !== 8))
    return null
  const parts = [...left, ...Array.from<string>({ length: fill }).fill('0'), ...right]
  if (parts.length !== 8 || parts.some(p => p.length === 0 || p.length > 4))
    return null
  return parts.map(p => Number.parseInt(p, 16))
}
