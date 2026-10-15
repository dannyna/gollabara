// Where `golla serve` listens: this machine and the tailnet, never the LAN (#15).
// There is no login, so the bound address and the source address are the only gates.

import type { NetworkInterfaceInfo } from 'node:os'
import { isTrustedSource } from './trusted'

export interface Listen {
  hosts: string[]
  /** Set by GOLLABARA_HOST: the user chose the exposure, so the source gate stands aside */
  explicit: boolean
}

/** GOLLABARA_HOST (comma-separated) when set, otherwise 127.0.0.1 plus this machine's Tailscale addresses */
export function listenHosts(override: string | undefined, interfaces: Record<string, NetworkInterfaceInfo[] | undefined>): Listen {
  const chosen = (override ?? '').split(',').map(h => h.trim()).filter(Boolean)
  if (chosen.length)
    return { hosts: [...new Set(chosen)], explicit: true }
  const tailnet = Object.values(interfaces)
    .flatMap(list => list ?? [])
    .filter(info => !info.internal && isTrustedSource(info.address))
    .map(info => info.address)
  return { hosts: [...new Set(['127.0.0.1', ...tailnet])], explicit: false }
}

/** Defense in depth behind the bind: only loopback and tailnet sources get an answer, unless GOLLABARA_HOST opened it up */
export function allowRequest(address: string | null | undefined, explicit: boolean): boolean {
  return explicit || isTrustedSource(address)
}
