// `golla setup|update|uninstall`. Setup copies what the service and the plugins need to a stable path,
// `<home>/app/<version>` behind an `app/current` symlink, so a `git pull` or a bunx cache eviction never
// breaks the running service. It then installs the login service and each detected harness's plugin.

import type { Context, InstallRecord } from './context'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { DEFAULT_PORT } from '../shared/config'
import { appDir, currentDir, plistPath, readRecord, recordPath, serverLog } from './context'
import { HARNESSES } from './harness'
import { plist, serviceState, startService, stopService } from './launchd'

/** What the installed app is made of: the bundled CLI, the built web UI, the plugin and its marketplace */
export const APP_FILES = ['package.json', 'dist/golla.js', 'web/dist/index.html', 'plugin/bin/hook.js', '.claude-plugin/marketplace.json']
const COPIED = ['package.json', 'dist', 'web/dist', 'plugin', '.claude-plugin']
const HEALTH_WAIT_MS = 20_000

export interface Report {
  lines: string[]
  ok: boolean
}

function reporter() {
  const report: Report = { lines: [], ok: true }
  const row = (label: string, text: string, broken = false) => {
    report.lines.push(`${label.padEnd(10)}${text}`)
    if (broken)
      report.ok = false
  }
  return { report, row }
}

export const sourceVersion = (source: string) => (JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')) as { version: string }).version
const sameDir = (a: string, b: string) => existsSync(a) && existsSync(b) && realpathSync(a) === realpathSync(b)

/** Copies the package to `app/<version>` and points `app/current` at it in one rename */
export function installApp(ctx: Context): string {
  const version = sourceVersion(ctx.source)
  const target = join(appDir(ctx), version)
  if (!sameDir(ctx.source, target)) {
    rmSync(target, { recursive: true, force: true })
    for (const entry of COPIED)
      cpSync(join(ctx.source, entry), join(target, entry), { recursive: true })
  }
  const link = join(appDir(ctx), `.current-${process.pid}`)
  rmSync(link, { force: true })
  symlinkSync(version, link)
  renameSync(link, currentDir(ctx))
  return version
}

/** Removes versions other than the current one; the service has already restarted on the new one */
function pruneVersions(ctx: Context, keep: string) {
  for (const entry of readdirSync(appDir(ctx))) {
    if (entry !== keep && entry !== 'current' && entry !== 'install.json')
      rmSync(join(appDir(ctx), entry), { recursive: true, force: true })
  }
}

async function healthy(port: number): Promise<boolean> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) })).ok
  }
  catch {
    return false
  }
}

async function waitHealthy(port: number, ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(500)) {
    if (await healthy(port))
      return true
  }
  return false
}

export function servicePlist(ctx: Context): string {
  const app = currentDir(ctx)
  return plist({
    label: ctx.label,
    // --no-install: the bundle is self-contained, so bun must never fetch packages on its own
    program: [ctx.bun, '--no-install', join(app, 'dist', 'golla.js'), 'serve'],
    // launchd's PATH is /usr/bin:/bin:/usr/sbin:/sbin; triage runs the user's claude or codex
    env: { GOLLABARA_PORT: String(ctx.port), GOLLABARA_DATA: ctx.dataDir, PATH: [dirname(ctx.bun), process.env.PATH ?? '/usr/bin:/bin'].join(':') },
    log: serverLog(ctx),
    cwd: ctx.dataDir,
  })
}

export async function setup(ctx: Context, { service = true } = {}): Promise<Report> {
  const { report, row } = reporter()
  const missing = APP_FILES.filter(f => !existsSync(join(ctx.source, f)))
  if (missing.length) {
    row('install', `${ctx.source} is missing ${missing.join(', ')}; run bun run build there first`, true)
    return report
  }

  mkdirSync(appDir(ctx), { recursive: true })
  mkdirSync(ctx.dataDir, { recursive: true })
  const version = installApp(ctx)
  const checkout = existsSync(join(ctx.source, '.git'))
  const record: InstallRecord = {
    version,
    source: checkout ? 'checkout' : 'npm',
    ...(checkout ? { checkout: ctx.source } : {}),
    label: ctx.label,
    port: ctx.port,
    dataDir: ctx.dataDir,
    service,
    installedAt: new Date().toISOString(),
  }
  writeFileSync(recordPath(ctx), `${JSON.stringify(record, null, 2)}\n`)
  row('install', `${version} at ${currentDir(ctx)}`)

  if (!service) {
    row('service', 'skipped (--no-service); run golla serve yourself')
  }
  else if (ctx.platform !== 'darwin') {
    row('service', 'the login service is macOS-only for now; run golla serve yourself')
  }
  else {
    // Another server on the port would answer the health wait while the service crash-loops, so it is not
    // loaded now; the plist still loads at the next login
    const taken = !(await serviceState(ctx)).loaded && await healthy(ctx.port)
    mkdirSync(ctx.launchAgents, { recursive: true })
    writeFileSync(plistPath(ctx), servicePlist(ctx))
    const error = taken ? null : await startService(ctx, plistPath(ctx))
    if (taken)
      row('service', `another server already answers on port ${ctx.port}, so ${ctx.label} was not started; stop it and run golla setup again, or pass --port`, true)
    else if (error)
      row('service', `${plistPath(ctx)} did not load: ${error}`, true)
    else if (await waitHealthy(ctx.port, HEALTH_WAIT_MS))
      row('service', `${ctx.label} running at login, logs in ${serverLog(ctx)}`)
    else
      row('service', `${ctx.label} loaded, but the server did not answer within ${HEALTH_WAIT_MS / 1000} s; see ${serverLog(ctx)}`, true)
  }

  let connected = 0
  for (const harness of HARNESSES) {
    if (!harness.detect(ctx))
      continue
    try {
      row(harness.id, await harness.install(ctx))
      connected++
    }
    catch (error) {
      row(harness.id, error instanceof Error ? error.message : String(error), true)
    }
  }
  if (!connected)
    row('harness', 'none detected (Claude Code: claude on PATH); run golla setup again after installing one')

  pruneVersions(ctx, version)
  row('open', `http://localhost:${ctx.port}`)
  if (ctx.port !== DEFAULT_PORT)
    row('', `hooks post to port ${DEFAULT_PORT} unless GOLLABARA_PORT=${ctx.port} is set where the harness runs`)
  return report
}

/** Rebuilds the checkout setup ran from, or fetches the latest from npm, then runs that version's setup, whose output is the report; the returned one holds only failures */
export async function update(ctx: Context): Promise<Report> {
  const { report, row } = reporter()
  const record = readRecord(ctx)
  if (!record) {
    row('update', 'not set up yet; run golla setup', true)
    return report
  }
  const flags = ['--port', String(record.port), ...(record.service ? [] : ['--no-service'])]
  let cmd: string[]
  if (record.source === 'checkout' && record.checkout) {
    const build = await ctx.exec([ctx.bun, 'run', 'build'], { cwd: record.checkout, inherit: true })
    if (build.code !== 0) {
      row('update', `bun run build failed in ${record.checkout}`, true)
      return report
    }
    cmd = [ctx.bun, join(record.checkout, 'src', 'cli.ts'), 'setup', ...flags]
  }
  else {
    cmd = [ctx.bun, 'x', 'gollabara@latest', 'setup', ...flags]
  }
  const res = await ctx.exec(cmd, { inherit: true })
  if (res.code !== 0)
    row('update', `${cmd.slice(1).join(' ')} failed`, true)
  return report
}

/** Refuses paths whose removal would take more than gollabara's own files */
function removable(path: string): boolean {
  const p = resolve(path)
  return isAbsolute(path) && p !== '/' && p !== homedir() && p !== dirname(homedir())
}

export async function uninstall(ctx: Context, { keepData = false } = {}): Promise<Report> {
  const { report, row } = reporter()
  if (ctx.platform === 'darwin') {
    const stopped = await stopService(ctx)
    const file = plistPath(ctx)
    const had = existsSync(file)
    rmSync(file, { force: true })
    row('service', stopped || had ? `${ctx.label} stopped and ${file} removed` : `${ctx.label} not installed`)
  }
  for (const harness of HARNESSES) {
    if (!harness.detect(ctx))
      continue
    try {
      row(harness.id, await harness.uninstall(ctx))
    }
    catch (error) {
      row(harness.id, error instanceof Error ? error.message : String(error), true)
    }
  }
  rmSync(appDir(ctx), { recursive: true, force: true })
  row('install', `${appDir(ctx)} removed`)
  if (keepData) {
    row('data', `${ctx.dataDir} kept (--keep-data)`)
  }
  else if (!removable(ctx.dataDir)) {
    row('data', `${ctx.dataDir} not removed: not a path gollabara owns`, true)
  }
  else {
    rmSync(ctx.dataDir, { recursive: true, force: true })
    row('data', `${ctx.dataDir} removed`)
  }
  try {
    rmdirSync(ctx.home) // only when empty
  }
  catch {}
  return report
}
