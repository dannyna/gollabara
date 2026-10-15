// Which requests a browser could have been tricked into sending. The source address alone is not enough:
// any page open in this machine's browser comes from loopback. A rebinding page (evil.example → 127.0.0.1)
// carries its own name in Host, and a cross-site page carries its Origin, so both are checked here.

import type { NetworkInterfaceInfo } from 'node:os'

const LOOPBACK = ['localhost', '127.0.0.1', '::1']
const WILDCARD = ['0.0.0.0', '::', '[::]']

/**
 * Host names this server answers to: loopback, the bound addresses (every interface address when one is a
 * wildcard), this machine's hostname with and without `.local` and as its first label (its MagicDNS name),
 * and GOLLABARA_ALLOWED_HOSTS (comma-separated). Names under `.ts.net` pass in `hostAllowed` itself.
 */
export function allowedHosts(
  listen: string[],
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined>,
  hostname: string,
  extra: string | undefined,
): Set<string> {
  const hosts = new Set(LOOPBACK)
  for (const host of listen) {
    if (WILDCARD.includes(host)) {
      for (const info of Object.values(interfaces).flatMap(list => list ?? []))
        hosts.add(bareHost(info.address))
    }
    else {
      hosts.add(bareHost(host))
    }
  }
  const name = bareHost(hostname)
  if (name) {
    const short = name.replace(/\.local$/, '')
    hosts.add(short).add(`${short}.local`).add(short.split('.')[0]!)
  }
  for (const host of (extra ?? '').split(','))
    hosts.add(bareHost(host))
  hosts.delete('')
  return hosts
}

/** A Host header or URL host without its port, brackets, trailing dot, or case */
export function bareHost(value: string): string {
  let host = value.trim().toLowerCase()
  if (host.startsWith('['))
    host = host.slice(1, !host.includes(']') ? undefined : host.indexOf(']'))
  else if (host.split(':').length === 2)
    host = host.split(':')[0]!
  return host.replace(/\.$/, '')
}

export function hostAllowed(value: string | null | undefined, allowed: Set<string>): boolean {
  if (!value)
    return false
  const host = bareHost(value)
  return allowed.has(host) || host.endsWith('.ts.net')
}

/**
 * An Origin header passes when absent (the hook, curl) or when it names an allowed host; `null` never does.
 * A `.ts.net` origin must also be the request's own host: anyone can serve a page from their tailnet via Funnel.
 */
export function originAllowed(origin: string | null, host: string | null, allowed: Set<string>): boolean {
  if (origin === null)
    return true
  let name: string
  try {
    name = bareHost(new URL(origin).host)
  }
  catch {
    return false
  }
  return allowed.has(name) || (name.endsWith('.ts.net') && name === bareHost(host ?? ''))
}

export interface RequestHead {
  method: string
  pathname: string
  headers: Headers
}

/**
 * The status to refuse a request with, or null to let it through. Every request must name an allowed Host;
 * mutations and the WebSocket upgrade must not come from another site; API mutations must be JSON, which a
 * page cannot send cross-origin without a preflight this server never answers.
 */
export function refuseRequest(req: RequestHead, allowed: Set<string>): 403 | 415 | null {
  if (!hostAllowed(req.headers.get('host'), allowed))
    return 403
  const mutation = req.method !== 'GET' && req.method !== 'HEAD'
  if (mutation || req.pathname === '/ws') {
    if (!originAllowed(req.headers.get('origin'), req.headers.get('host'), allowed))
      return 403
    if (req.headers.get('sec-fetch-site') === 'cross-site')
      return 403
  }
  if (mutation && req.pathname.startsWith('/api/') && !isJson(req.headers.get('content-type')))
    return 415
  return null
}

function isJson(contentType: string | null): boolean {
  return contentType?.split(';')[0]!.trim().toLowerCase() === 'application/json'
}
