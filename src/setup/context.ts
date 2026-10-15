// What `golla setup|update|uninstall|doctor` act on: where the app is installed, the login service's label,
// the port, the data dir and the `claude` binary. Each can be overridden, so tests and trial runs never
// touch the user's real service, plugin or data. Commands run through an injected `exec`.

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { dataDir, DEFAULT_PORT } from '../shared/config'
import { packageRoot } from '../shared/package-root'

export interface ExecResult {
  code: number
  stdout: string
  stderr: string
}

/** Runs a command. `inherit` streams its output to the terminal instead of capturing it. A missing binary is code 127. */
export type Exec = (cmd: string[], options?: { cwd?: string, inherit?: boolean }) => Promise<ExecResult>

export const exec: Exec = async (cmd, { cwd, inherit = false } = {}) => {
  try {
    if (inherit) {
      const proc = Bun.spawn(cmd, { cwd, stdio: ['inherit', 'inherit', 'inherit'] })
      return { code: await proc.exited, stdout: '', stderr: '' }
    }
    const proc = Bun.spawn(cmd, { cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
    return { code, stdout, stderr }
  }
  catch (error) {
    return { code: 127, stdout: '', stderr: error instanceof Error ? error.message : String(error) }
  }
}

export const DEFAULT_LABEL = 'dev.gollabara.server'

/** What the last `golla setup` installed, kept next to the app so `update`, `doctor` and `uninstall` reuse it */
export interface InstallRecord {
  version: string
  /** `checkout`: set up from a git checkout, which `update` rebuilds; `npm`: from the published package */
  source: 'npm' | 'checkout'
  checkout?: string
  label: string
  port: number
  dataDir: string
  service: boolean
  installedAt: string
}

export interface Context {
  /** GOLLABARA_HOME, ~/.gollabara: the app is installed under `app/` */
  home: string
  /** GOLLABARA_SERVICE_LABEL: the LaunchAgent label and plist name */
  label: string
  port: number
  dataDir: string
  /** GOLLABARA_CLAUDE: the Claude Code binary */
  claude: string
  /** GOLLABARA_CODEX: the Codex CLI binary */
  codex: string
  launchAgents: string
  /** Absolute bun path the service runs with */
  bun: string
  /** The package this CLI runs from, which setup copies */
  source: string
  uid: number
  platform: NodeJS.Platform
  exec: Exec
}

export const appDir = (ctx: Pick<Context, 'home'>) => join(ctx.home, 'app')
/** The stable path the service and the plugin marketplace point at; a symlink to the installed version */
export const currentDir = (ctx: Pick<Context, 'home'>) => join(appDir(ctx), 'current')
export const recordPath = (ctx: Pick<Context, 'home'>) => join(appDir(ctx), 'install.json')
export const plistPath = (ctx: Pick<Context, 'launchAgents' | 'label'>) => join(ctx.launchAgents, `${ctx.label}.plist`)
/** The service's stdout and stderr */
export const serverLog = (ctx: Pick<Context, 'dataDir'>) => join(ctx.dataDir, 'server.log')

export function readRecord(ctx: Pick<Context, 'home'>): InstallRecord | null {
  try {
    return JSON.parse(readFileSync(recordPath(ctx), 'utf8')) as InstallRecord
  }
  catch {
    return null
  }
}

/** Flag, then env, then what the last setup recorded, then the default */
export function resolveContext(flags: { port?: number } = {}, env = process.env): Context {
  const home = env.GOLLABARA_HOME ?? join(homedir(), '.gollabara')
  const record = readRecord({ home })
  const source = packageRoot(import.meta.dir)
  if (!source)
    throw new Error(`no gollabara package.json above ${import.meta.dir}`)
  return {
    home,
    label: env.GOLLABARA_SERVICE_LABEL ?? record?.label ?? DEFAULT_LABEL,
    port: flags.port ?? (env.GOLLABARA_PORT ? Number(env.GOLLABARA_PORT) : record?.port ?? DEFAULT_PORT),
    dataDir: env.GOLLABARA_DATA ?? record?.dataDir ?? dataDir(),
    claude: env.GOLLABARA_CLAUDE ?? 'claude',
    codex: env.GOLLABARA_CODEX ?? 'codex',
    launchAgents: join(homedir(), 'Library', 'LaunchAgents'),
    bun: process.execPath,
    source,
    uid: process.getuid?.() ?? 0,
    platform: process.platform,
    exec,
  }
}

/** Whether `bin` is runnable: an existing path, or a name on PATH */
export function found(bin: string): boolean {
  return bin.includes('/') ? existsSync(bin) : Bun.which(bin) !== null
}
