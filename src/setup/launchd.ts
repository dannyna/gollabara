// The macOS login service: a LaunchAgent that runs `golla serve` from the stable install path at login and
// restarts it when it exits. `plist` and `parsePrint` are pure; the rest drives `launchctl` through `ctx.exec`.

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
