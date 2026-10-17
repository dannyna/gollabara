// The macOS login service: a LaunchAgent that runs `golla serve` from the stable install path at login and
// restarts it when it exits. `plist`, `parsePrint` and `parseBtm` are pure; the rest drives `launchctl` and
// `sfltool` through `ctx.exec`.

import type { Context } from './context'

export interface PlistOptions {
  label: string
  program: string[]
  env: Record<string, string>
  /** stdout and stderr both go here */
  log: string
  cwd: string
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const str = (s: string) => `<string>${escape(s)}</string>`

export function plist({ label, program, env, log, cwd }: PlistOptions): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  ${str(label)}
  <key>ProgramArguments</key>
  <array>
${program.map(arg => `    ${str(arg)}`).join('\n')}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(env).map(([k, v]) => `    <key>${escape(k)}</key>\n    ${str(v)}`).join('\n')}
  </dict>
  <key>WorkingDirectory</key>
  ${str(cwd)}
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  ${str(log)}
  <key>StandardErrorPath</key>
  ${str(log)}
</dict>
</plist>
`
}

export interface ServiceState {
  loaded: boolean
  running: boolean
  pid: number | null
}

/** Reads `launchctl print gui/<uid>/<label>`: its top-level `state = running` and `pid = N` lines */
export function parsePrint(text: string): Pick<ServiceState, 'running' | 'pid'> {
  const state = /^\tstate = (\S+)/m.exec(text)?.[1]
  const pid = /^\tpid = (\d+)/m.exec(text)?.[1]
  return { running: state === 'running', pid: pid ? Number(pid) : null }
}

export interface LoginItem {
  /** Background Task Management lets it start at login; a disallowed agent runs only when bootstrapped by hand */
  allowed: boolean
  enabled: boolean
  /** The executable's name as Login Items lists it ("bun") */
  name: string | null
}

/**
 * Reads `sfltool dumpbtm` for the LaunchAgent's record, the `#N:` block whose `Identifier` is `<n>.<label>`.
 * The URL can name another home (`/Users/501`), so only the identifier is matched. The last match wins.
 */
export function parseBtm(dump: string, label: string): LoginItem | null {
  let found: LoginItem | null = null
  for (const block of dump.split(/^\s*#\d+:\s*$/m)) {
    const id = /^\s*Identifier:\s*\d+\.(\S+)\s*$/m.exec(block)?.[1]
    if (id !== label)
      continue
    const disposition = /^\s*Disposition:\s*\[([^\]]*)\]/m.exec(block)?.[1]
    if (disposition === undefined)
      continue
    const flags = disposition.split(',').map(f => f.trim())
    const name = /^\s*Name:(.*)$/m.exec(block)?.[1].trim() || null
    found = { allowed: flags.includes('allowed'), enabled: flags.includes('enabled'), name: name === '(null)' ? null : name }
  }
  return found
}

/** How long `sfltool dumpbtm` gets before it counts as unknown (it answers in about a second when it answers) */
export const BTM_TIMEOUT_MS = 4000

/** The service's Login Items record; null off macOS, or when `sfltool` is missing, hangs, fails or lists no record */
export async function loginItemState(ctx: Pick<Context, 'platform' | 'label' | 'exec'>): Promise<LoginItem | null> {
  if (ctx.platform !== 'darwin')
    return null
  try {
    // dumpbtm has been seen to hang for minutes when the BTM daemon is busy; doctor and setup must not wait on it
    const res = await ctx.exec(['sfltool', 'dumpbtm'], { timeoutMs: BTM_TIMEOUT_MS })
    return res.code === 0 ? parseBtm(res.stdout, ctx.label) : null
  }
  catch {
    return null
  }
}

/** Where to fix a disallowed login item; doctor and setup share the wording */
export function blockedAtLogin(item: LoginItem) {
  return `macOS blocks it at login: allow ${item.name || 'bun'} under System Settings → General → Login Items & Extensions`
}

const domain = (ctx: Pick<Context, 'uid'>) => `gui/${ctx.uid}`
const target = (ctx: Pick<Context, 'uid' | 'label'>) => `${domain(ctx)}/${ctx.label}`

export async function serviceState(ctx: Pick<Context, 'uid' | 'label' | 'exec'>): Promise<ServiceState> {
  const res = await ctx.exec(['launchctl', 'print', target(ctx)])
  if (res.code !== 0)
    return { loaded: false, running: false, pid: null }
  return { loaded: true, ...parsePrint(res.stdout) }
}

export async function stopService(ctx: Pick<Context, 'uid' | 'label' | 'exec'>): Promise<boolean> {
  if (!(await serviceState(ctx)).loaded)
    return false
  await ctx.exec(['launchctl', 'bootout', target(ctx)])
  return true
}

/** Loads (or reloads) the plist. A bootout finishes asynchronously, so bootstrap retries briefly while launchd lets go. */
export async function startService(ctx: Pick<Context, 'uid' | 'label' | 'exec'>, plistFile: string, retryMs = 500): Promise<string | null> {
  await stopService(ctx)
  let error = ''
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await ctx.exec(['launchctl', 'bootstrap', domain(ctx), plistFile])
    if (res.code === 0)
      return null
    error = (res.stderr || res.stdout).trim()
    await Bun.sleep(retryMs)
  }
  return error || 'launchctl bootstrap failed'
}
