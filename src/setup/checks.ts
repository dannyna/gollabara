// The machine-level rows of `golla doctor`: the installed app, the login service, each harness's plugin,
// sleep settings and Tailscale. Sleep and Tailscale are advice and never count as broken.

import type { Context, ExecResult } from './context'
import type { Check } from './harness'
import { existsSync, readlinkSync } from 'node:fs'
import { currentDir, plistPath, readRecord, serverLog } from './context'
import { HARNESSES } from './harness'
import { blockedAtLogin, loginItemState, serviceState } from './launchd'

const TAILSCALE_APP = '/Applications/Tailscale.app/Contents/MacOS/Tailscale'

/** `pmset -g custom` → minutes of idle before system sleep per power source; 0 is never, null is no such section */
export function parseSleep(text: string): { ac: number | null, battery: number | null } {
  const out = { ac: null as number | null, battery: null as number | null }
  let source: keyof typeof out | null = null
  for (const line of text.split('\n')) {
    if (line.startsWith('AC Power:'))
      source = 'ac'
    else if (line.startsWith('Battery Power:'))
      source = 'battery'
    const sleep = /^\s*sleep\s+(\d+)/.exec(line)
    if (sleep && source)
      out[source] = Number(sleep[1])
  }
  return out
}

export function sleepCheck(text: string): Check {
  const { ac, battery } = parseSleep(text)
  const parts: string[] = []
  if (ac !== null)
    parts.push(ac ? `sleeps after ${ac} min idle on power, which stops remote viewing (sudo pmset -c sleep 0 keeps it awake)` : 'never sleeps on power')
  if (battery)
    parts.push(`sleeps after ${battery} min idle on battery`)
  return { label: 'sleep', text: parts.join('; ') || 'no sleep settings read' }
}

/** `tailscale status --json` and `tailscale serve status --json` → one advisory line */
export function tailscaleCheck(status: ExecResult, serve: ExecResult): Check {
  const label = 'tailscale'
  if (status.code !== 0)
    return { label, text: 'installed, not running, so other devices can\'t reach the stream' }
  let state = 'unknown'
  try {
    state = (JSON.parse(status.stdout) as { BackendState?: string }).BackendState ?? state
  }
  catch {}
  if (state !== 'Running')
    return { label, text: `installed, ${state}` }
  let served = false
  try {
    served = serve.code === 0 && Object.keys(JSON.parse(serve.stdout) as object).length > 0
  }
  catch {}
  return { label, text: `running, ${served ? 'serve configured' : 'no serve config'}` }
}

function installCheck(ctx: Context): Check {
  const label = 'install'
  const record = readRecord(ctx)
  if (!record)
    return { label, text: `not set up (golla setup); this CLI runs from ${ctx.source}` }
  let version: string
  try {
    version = readlinkSync(currentDir(ctx))
  }
  catch {
    return { label, text: `${currentDir(ctx)} is missing (golla setup)`, broken: true }
  }
  const from = record.source === 'checkout' ? `checkout ${record.checkout}` : 'npm'
  return { label, text: `${version} at ${currentDir(ctx)}, from ${from}` }
}

export async function serviceCheck(ctx: Context): Promise<Check> {
  const label = 'service'
  if (ctx.platform !== 'darwin')
    return { label, text: 'the login service is macOS-only for now; run golla serve yourself' }
  const file = plistPath(ctx)
  if (!existsSync(file))
    return { label, text: `${ctx.label} not installed (golla setup)` }
  const state = await serviceState(ctx)
  if (!state.loaded) {
    // A disallowed login item never starts at login, and golla setup alone won't change that
    const item = await loginItemState(ctx)
    if (item && !item.allowed)
      return { label, text: `${file} is there, but ${blockedAtLogin(item)}, then run golla setup`, broken: true }
    return { label, text: `${file} is there but not loaded (golla setup)`, broken: true }
  }
  if (!state.running)
    return { label, text: `${ctx.label} loaded but not running; see ${serverLog(ctx)}`, broken: true }
  // Running now, but it won't come back after a reboot; advice only, like sleep
  const item = await loginItemState(ctx)
  if (item && !item.allowed)
    return { label, text: `${ctx.label} running, pid ${state.pid}, but ${blockedAtLogin(item)}` }
  return { label, text: `${ctx.label} running, pid ${state.pid}` }
}

async function tailscale(ctx: Context): Promise<Check> {
  const bin = Bun.which('tailscale') ?? (existsSync(TAILSCALE_APP) ? TAILSCALE_APP : null)
  if (!bin)
    return { label: 'tailscale', text: 'not installed; the stream stays on this machine' }
  const [status, serve] = await Promise.all([ctx.exec([bin, 'status', '--json']), ctx.exec([bin, 'serve', 'status', '--json'])])
  return tailscaleCheck(status, serve)
}

export async function systemChecks(ctx: Context): Promise<Check[]> {
  const checks: Check[] = [installCheck(ctx), await serviceCheck(ctx)]
  for (const harness of HARNESSES)
    checks.push(await harness.status(ctx))
  if (ctx.platform === 'darwin') {
    const pmset = await ctx.exec(['pmset', '-g', 'custom'])
    if (pmset.code === 0)
      checks.push(sleepCheck(pmset.stdout))
  }
  checks.push(await tailscale(ctx))
  return checks
}
