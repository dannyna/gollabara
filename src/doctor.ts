// `golla doctor` — says what is and isn't working: the server, the plugin version each harness runs,
// how the hooks have fared (the hook health log), and the machine-level checks it is given (the installed
// app, the login service, plugins, sleep, Tailscale). Plain lines, no colors.

import type { Check } from './setup/harness'
import type { Health } from './shared/types'
import { errorClass, percentile, readHealth } from './hook/health'

const HEALTH_TIMEOUT_MS = 2000
/** Failures listed by name; older ones only count */
const SHOWN_FAILURES = 5

export interface DoctorOptions {
  url: string
  dataDir: string
  now?: number
  /** Machine-level rows, listed before `data`; `golla doctor` passes `systemChecks` */
  checks?: () => Promise<Check[]>
}

export interface DoctorReport {
  lines: string[]
  /** The server is unreachable, a plugin is outdated, or a check is broken: `golla doctor` exits 1 */
  broken: boolean
}

export async function doctor({ url, dataDir, now = Date.now(), checks }: DoctorOptions): Promise<DoctorReport> {
  const lines: string[] = []
  let broken = false
  const row = (label: string, text: string, isBroken = false) => {
    lines.push(`${label.padEnd(10)}${text}`)
    broken ||= isBroken
  }

  let health: Health | null = null
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
    if (!res.ok)
      throw new Error(`http ${res.status}`)
    health = await res.json() as Health
    row('server', `${url} reachable, expects plugin ${health.version}`)
  }
  catch (error) {
    row('server', `${url} not reachable (${errorClass(error)})`, true)
  }

  if (health) {
    if (!health.hooks.length)
      row('plugin', 'no hook seen yet')
    for (const hook of health.hooks) {
      const version = hook.version ?? 'no version'
      const state = hook.outdated ? `plugin outdated, expected ${health.version}` : 'ok'
      row('plugin', `${hook.harness} ${version} (${state}), seen ${ago(now - hook.seenAt)}`, hook.outdated)
    }
  }

  const entries = readHealth(dataDir)
  if (!entries.length) {
    row('latency', 'no hook runs logged')
  }
  else {
    const ms = entries.map(e => e.ms).sort((a, b) => a - b)
    row('latency', `p50 ${percentile(ms, 0.5)} ms, p95 ${percentile(ms, 0.95)} ms over ${ms.length} runs`)
  }
  const failures = entries.filter(e => !e.ok)
  if (!failures.length) {
    row('failures', 'none logged')
  }
  else {
    row('failures', `${failures.length} logged${failures.length > SHOWN_FAILURES ? `, latest ${SHOWN_FAILURES}` : ''}`)
    for (const f of failures.slice(-SHOWN_FAILURES))
      row('', `${stamp(f.at)} ${f.event}${f.harness ? ` (${f.harness})` : ''} ${f.error ?? 'error'} after ${f.ms} ms`)
  }
  for (const check of await checks?.() ?? [])
    row(check.label, check.text, check.broken)
  row('data', dataDir)
  return { lines, broken }
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60)
    return `${s} s ago`
  if (s < 3600)
    return `${Math.round(s / 60)} min ago`
  if (s < 86_400)
    return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86_400)} d ago`
}

/** Local time, `YYYY-MM-DD HH:MM:SS` */
function stamp(at: number): string {
  return new Date(at).toLocaleString('sv-SE')
}
