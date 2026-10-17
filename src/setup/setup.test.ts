import type { Server } from 'bun'
import type { Context, Exec, ExecResult } from './context'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { doctor } from '../doctor'
import { parseSleep, serviceCheck, sleepCheck, tailscaleCheck } from './checks'
import { currentDir, plistPath, readRecord, exec as realExec } from './context'
import { claudeCode } from './harness'
import { APP_FILES, setup, uninstall, update } from './index'
import { BTM_TIMEOUT_MS, loginItemState, parseBtm, parsePrint, plist } from './launchd'

const root = mkdtempSync(join(tmpdir(), 'gollabara-setup-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

let n = 0
/** A built package at `version`, a scratch home, data dir and LaunchAgents dir, and a `claude` binary that exists */
function scratch(version = '0.1.0') {
  const dir = join(root, String(n++))
  const source = join(dir, 'pkg')
  for (const file of APP_FILES) {
    mkdirSync(dirname(join(source, file)), { recursive: true })
    writeFileSync(join(source, file), file === 'package.json' ? JSON.stringify({ name: 'gollabara', version }) : file)
  }
  const claude = join(dir, 'claude')
  writeFileSync(claude, '')
  return { dir, source, claude }
}

const ok = (stdout = ''): ExecResult => ({ code: 0, stdout, stderr: '' })

/** Records every command; `answer` returns canned output for the ones a test cares about */
function fakeExec(answer: (cmd: string[]) => ExecResult | undefined = () => undefined) {
  const calls: { cmd: string[], cwd?: string, timeoutMs?: number }[] = []
  const exec: Exec = async (cmd, options) => {
    calls.push({ cmd, cwd: options?.cwd, timeoutMs: options?.timeoutMs })
    return answer(cmd) ?? ok()
  }
  return { exec, calls }
}

function context(s: ReturnType<typeof scratch>, exec: Exec, over: Partial<Context> = {}): Context {
  return {
    home: join(s.dir, 'home'),
    label: 'dev.gollabara.test',
    port: 1,
    dataDir: join(s.dir, 'data'),
    claude: s.claude,
    codex: join(s.dir, 'no-codex'),
    launchAgents: join(s.dir, 'LaunchAgents'),
    bun: '/opt/bun/bin/bun',
    source: s.source,
    uid: 501,
    platform: 'linux',
    exec,
    ...over,
  }
}

/** `sfltool dumpbtm` with an unrelated record, the service's record with `disposition`, and a longer label */
function btm(disposition: string, label = 'dev.gollabara.test') {
  return ` ========================
 Records for UID 501 : 00000000-0000-0000-0000-000000000000
 ========================

 ServiceManagement migrated: true
 SharedFileList migrated: true

 Items:

 #1:
                 UUID: 11111111-1111-1111-1111-111111111111
                 Name: (null)
       Developer Name: (null)
                 Type: curated (0x20)
          Disposition: [enabled, allowed, notified] (0xb)
                  URL: (null)
           Generation: 0

 #25:
                 UUID: 00000000-0000-0000-0000-000000000000
                 Name: bun
       Developer Name: Jarred Sumner
      Team Identifier: 7FRXF46ZSN
                 Type: legacy agent (0x10008)
                Flags: [ legacy ] (0x1)
          Disposition: ${disposition}
           Identifier: 8.${label}
                  URL: /Users/501/Library/LaunchAgents/${label}.plist
      Executable Path: /Users/501/.bun/bin/bun
           Generation: 45

 #26:
                 UUID: 22222222-2222-2222-2222-222222222222
                 Name: other
       Developer Name: Someone
                 Type: legacy agent (0x10008)
          Disposition: [enabled, allowed, notified] (0xb)
           Identifier: 8.${label}.other
                  URL: /Users/501/Library/LaunchAgents/${label}.other.plist
           Generation: 3
`
}
const DISALLOWED = '[enabled, disallowed, notified] (0x9)'
const ALLOWED = '[enabled, allowed, notified] (0xb)'

const claudeCalls = (calls: { cmd: string[] }[], claude: string) => calls.filter(c => c.cmd[0] === claude).map(c => c.cmd.slice(1).join(' '))

describe('golla setup', () => {
  test('copies the app to a versioned dir behind app/current, records it, and installs the Claude Code plugin from there', async () => {
    const s = scratch()
    const { exec, calls } = fakeExec()
    const ctx = context(s, exec)
    const report = await setup(ctx, { service: false })
    expect(report.ok).toBe(true)
    expect(readlinkSync(currentDir(ctx))).toBe('0.1.0')
    for (const file of APP_FILES)
      expect(existsSync(join(currentDir(ctx), file))).toBe(true)
    expect(readRecord(ctx)).toMatchObject({ version: '0.1.0', source: 'npm', label: 'dev.gollabara.test', port: 1, service: false })
    expect(claudeCalls(calls, s.claude)).toEqual([`plugin marketplace add ${currentDir(ctx)}`, 'plugin install gollabara@gollabara'])
    expect(report.lines.join('\n')).toContain(`claude    plugin gollabara@gollabara from ${currentDir(ctx)}/plugin`)
  })

  test('running it again with a newer version switches app/current and prunes the old version', async () => {
    const s = scratch('0.1.0')
    const ctx = context(s, fakeExec().exec)
    await setup(ctx, { service: false })
    writeFileSync(join(s.source, 'package.json'), JSON.stringify({ name: 'gollabara', version: '0.2.0' }))
    expect((await setup(ctx, { service: false })).ok).toBe(true)
    expect(readlinkSync(currentDir(ctx))).toBe('0.2.0')
    expect(existsSync(join(ctx.home, 'app', '0.1.0'))).toBe(false)
  })

  test('a package that was not built is refused before anything is installed', async () => {
    const s = scratch()
    rmSync(join(s.source, 'dist'), { recursive: true })
    const ctx = context(s, fakeExec().exec)
    const report = await setup(ctx, { service: false })
    expect(report.ok).toBe(false)
    expect(report.lines[0]).toContain('missing dist/golla.js')
    expect(existsSync(ctx.home)).toBe(false)
  })

  test('without claude on the machine no plugin is installed', async () => {
    const s = scratch()
    const { exec, calls } = fakeExec()
    const report = await setup(context(s, exec, { claude: join(s.dir, 'no-claude') }), { service: false })
    expect(report.ok).toBe(true)
    expect(calls).toEqual([])
    expect(report.lines.join('\n')).toContain('harness   none detected')
  })

  describe('on macOS', () => {
    let server: Server<undefined> | undefined
    afterEach(() => server?.stop(true))

    test('writes the LaunchAgent pointing at bun and app/current, loads it, and waits for the server', async () => {
      const s = scratch()
      let loaded = false
      // Answers only once launchd has loaded the service
      server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => loaded ? Response.json({ version: '0.1.0', hooks: [] }) : new Response(null, { status: 503 }) })
      const { exec, calls } = fakeExec((cmd) => {
        if (cmd[0] !== 'launchctl')
          return undefined
        if (cmd[1] === 'print')
          return loaded ? ok('\tstate = running\n\tpid = 42\n') : { code: 113, stdout: '', stderr: 'not found' }
        if (cmd[1] === 'bootstrap')
          loaded = true
        return undefined
      })
      const ctx = context(s, exec, { platform: 'darwin', port: server.port! })
      const report = await setup(ctx)
      expect(report.ok).toBe(true)
      const xml = readFileSync(plistPath(ctx), 'utf8')
      expect(xml).toContain(`<string>/opt/bun/bin/bun</string>\n    <string>--no-install</string>\n    <string>${currentDir(ctx)}/dist/golla.js</string>\n    <string>serve</string>`)
      expect(xml).toContain(`<key>GOLLABARA_PORT</key>\n    <string>${server.port}</string>`)
      expect(calls.filter(c => c.cmd[0] === 'launchctl').map(c => c.cmd.slice(1).join(' '))).toEqual([
        'print gui/501/dev.gollabara.test',
        'print gui/501/dev.gollabara.test',
        `bootstrap gui/501 ${plistPath(ctx)}`,
      ])
      expect(report.lines.join('\n')).toContain('service   dev.gollabara.test running at login')
      expect(report.lines.join('\n')).not.toContain('Login Items')
    })

    test('a login item macOS disallows: setup still succeeds, with advice on where to allow it', async () => {
      const s = scratch()
      let loaded = false
      server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => loaded ? Response.json({ version: '0.1.0', hooks: [] }) : new Response(null, { status: 503 }) })
      const { exec } = fakeExec((cmd) => {
        if (cmd[0] === 'sfltool')
          return ok(btm(DISALLOWED))
        if (cmd[0] === 'launchctl' && cmd[1] === 'print')
          return loaded ? ok('\tstate = running\n\tpid = 42\n') : { code: 113, stdout: '', stderr: 'not found' }
        if (cmd[0] === 'launchctl' && cmd[1] === 'bootstrap')
          loaded = true
        return undefined
      })
      const report = await setup(context(s, exec, { platform: 'darwin', port: server.port! }))
      expect(report.ok).toBe(true)
      expect(report.lines.join('\n')).toContain('service   dev.gollabara.test running now, but macOS blocks it at login: allow bun under System Settings → General → Login Items & Extensions; logs in ')
      expect(report.lines.join('\n')).not.toContain('running at login')
    })

    test('another server already on the port: the plist is written but not loaded, and setup fails', async () => {
      server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => Response.json({ version: '0.1.0', hooks: [] }) })
      const s = scratch()
      const { exec, calls } = fakeExec(cmd => cmd[0] === 'launchctl' && cmd[1] === 'print' ? { code: 113, stdout: '', stderr: 'not found' } : undefined)
      const ctx = context(s, exec, { platform: 'darwin', port: server.port! })
      const report = await setup(ctx)
      expect(report.ok).toBe(false)
      expect(existsSync(plistPath(ctx))).toBe(true)
      expect(calls.some(c => c.cmd[1] === 'bootstrap')).toBe(false)
      expect(report.lines.join('\n')).toContain(`another server already answers on port ${server.port}`)
    })
  })
})

describe('golla uninstall', () => {
  async function installed() {
    const s = scratch()
    const { exec, calls } = fakeExec((cmd) => {
      if (cmd.join(' ').endsWith('plugin list --json'))
        return ok(JSON.stringify([{ id: 'gollabara@gollabara', version: '0.1.0' }, { id: 'other@x' }]))
      if (cmd.join(' ').endsWith('marketplace list --json'))
        return ok(JSON.stringify([{ name: 'gollabara', path: '/x' }]))
      if (cmd[0] === 'launchctl' && cmd[1] === 'print')
        return ok('\tstate = running\n\tpid = 42\n')
      return undefined
    })
    const ctx = context(s, exec, { platform: 'darwin' })
    await setup({ ...ctx, platform: 'linux' }, { service: false })
    mkdirSync(ctx.launchAgents, { recursive: true })
    writeFileSync(plistPath(ctx), 'plist')
    writeFileSync(join(ctx.dataDir, 'stream.db'), '')
    calls.length = 0
    return { s, ctx, calls }
  }

  test('unloads and removes the plist, the plugin and marketplace, the app and the data', async () => {
    const { s, ctx, calls } = await installed()
    const report = await uninstall(ctx)
    expect(report.ok).toBe(true)
    expect(calls.some(c => c.cmd.join(' ') === 'launchctl bootout gui/501/dev.gollabara.test')).toBe(true)
    expect(claudeCalls(calls, s.claude)).toEqual([
      'plugin list --json',
      'plugin uninstall gollabara@gollabara',
      'plugin marketplace list --json',
      'plugin marketplace remove gollabara',
    ])
    expect(existsSync(plistPath(ctx))).toBe(false)
    expect(existsSync(ctx.home)).toBe(false)
    expect(existsSync(ctx.dataDir)).toBe(false)
  })

  test('--keep-data keeps the data dir', async () => {
    const { ctx } = await installed()
    await uninstall(ctx, { keepData: true })
    expect(existsSync(join(ctx.dataDir, 'stream.db'))).toBe(true)
    expect(existsSync(join(ctx.home, 'app'))).toBe(false)
  })
})

describe('golla update', () => {
  test('a checkout install rebuilds the checkout and runs its setup', async () => {
    const s = scratch()
    mkdirSync(join(s.source, '.git'))
    const { exec, calls } = fakeExec()
    const ctx = context(s, exec, { claude: join(s.dir, 'no-claude') })
    await setup(ctx, { service: false })
    expect((await update(ctx)).ok).toBe(true)
    expect(calls).toEqual([
      { cmd: ['/opt/bun/bin/bun', 'run', 'build'], cwd: s.source },
      { cmd: ['/opt/bun/bin/bun', join(s.source, 'src', 'cli.ts'), 'setup', '--port', '1', '--no-service'], cwd: undefined },
    ])
  })

  test('an npm install runs the latest published setup', async () => {
    const s = scratch()
    const { exec, calls } = fakeExec()
    const ctx = context(s, exec, { claude: join(s.dir, 'no-claude') })
    await setup(ctx, { service: false })
    await update(ctx)
    expect(calls.map(c => c.cmd)).toEqual([['/opt/bun/bin/bun', 'x', 'gollabara@latest', 'setup', '--port', '1', '--no-service']])
  })

  test('nothing set up is an error', async () => {
    expect((await update(context(scratch(), fakeExec().exec))).ok).toBe(false)
  })
})

describe('launchd', () => {
  test('the plist runs at load, stays alive, logs both streams and escapes XML', () => {
    const xml = plist({ label: 'dev.gollabara.test', program: ['/bun', 'a&b'], env: { K: '<v>' }, log: '/d/server.log', cwd: '/d' })
    expect(xml).toContain('<string>a&amp;b</string>')
    expect(xml).toContain('<key>K</key>\n    <string>&lt;v&gt;</string>')
    expect(xml).toContain('<key>RunAtLoad</key>\n  <true/>')
    expect(xml).toContain('<key>KeepAlive</key>\n  <true/>')
    expect(xml).toContain('<key>StandardOutPath</key>\n  <string>/d/server.log</string>')
    expect(xml).toContain('<key>StandardErrorPath</key>\n  <string>/d/server.log</string>')
  })

  test('sfltool dumpbtm: the record whose identifier is <n>.<label>, not a longer label', () => {
    expect(parseBtm(btm(DISALLOWED), 'dev.gollabara.test')).toEqual({ allowed: false, enabled: true, name: 'bun' })
    expect(parseBtm(btm(ALLOWED), 'dev.gollabara.test')).toEqual({ allowed: true, enabled: true, name: 'bun' })
    expect(parseBtm(btm('[disabled, allowed] (0x2)'), 'dev.gollabara.test')).toEqual({ allowed: true, enabled: false, name: 'bun' })
    expect(parseBtm(btm(DISALLOWED, 'dev.gollabara.server.x'), 'dev.gollabara.test')).toBeNull()
    expect(parseBtm(btm(DISALLOWED), 'gollabara.test')).toBeNull()
    expect(parseBtm('', 'dev.gollabara.test')).toBeNull()
  })

  test('sfltool dumpbtm gets a timeout, and a hung one reads as unknown', async () => {
    const { exec, calls } = fakeExec(cmd => cmd[0] === 'sfltool' ? { code: 124, stdout: '', stderr: '' } : undefined)
    expect(await loginItemState({ platform: 'darwin', label: 'dev.gollabara.test', exec })).toBeNull()
    expect(calls).toEqual([{ cmd: ['sfltool', 'dumpbtm'], cwd: undefined, timeoutMs: BTM_TIMEOUT_MS }])
  })

  test('exec kills a command that runs past timeoutMs and answers 124', async () => {
    const started = Date.now()
    const res = await realExec(['sleep', '30'], { timeoutMs: 100 })
    expect(res.code).toBe(124)
    expect(Date.now() - started).toBeLessThan(5000)
    expect((await realExec(['true'], { timeoutMs: 1000 })).code).toBe(0)
  })

  test('launchctl print: running with a pid, or loaded and waiting', () => {
    const running = 'gui/501/dev.gollabara.test = {\n\tactive count = 1\n\tstate = running\n\n\tprogram = /bun\n\tpid = 735\n\tenvironment = {\n\t\tstate = nested\n\t}\n}'
    expect(parsePrint(running)).toEqual({ running: true, pid: 735 })
    expect(parsePrint('gui/501/x = {\n\tstate = not running\n\tlast exit code = 1\n}')).toEqual({ running: false, pid: null })
  })
})

describe('doctor checks', () => {
  const pmset = (ac: number, battery?: number) =>
    `${battery === undefined ? '' : `Battery Power:\n sleep                ${battery}\n displaysleep         10\n`}AC Power:\n Sleep On Power Button 1\n sleep                ${ac}\n displaysleep         180\n`

  test('sleep settings: minutes per power source, with advice when the Mac sleeps on power', () => {
    expect(parseSleep(pmset(1, 5))).toEqual({ ac: 1, battery: 5 })
    expect(parseSleep(pmset(0))).toEqual({ ac: 0, battery: null })
    expect(sleepCheck(pmset(1, 5)).text).toBe('sleeps after 1 min idle on power, which stops remote viewing (sudo pmset -c sleep 0 keeps it awake); sleeps after 5 min idle on battery')
    expect(sleepCheck(pmset(0))).toEqual({ label: 'sleep', text: 'never sleeps on power' })
  })

  test('claude plugin: the version of the folder it runs from, over the one recorded at install', async () => {
    const s = scratch()
    const listed = (plugin: object) => context(s, fakeExec(cmd => cmd.join(' ').endsWith('plugin list --json') ? ok(JSON.stringify([plugin])) : undefined).exec)
    const plugin = { id: 'gollabara@gollabara', version: '0.1.0', enabled: true, readFromFolder: '/app/current/plugin' }
    expect((await claudeCode.status(listed({ ...plugin, folderVersion: '0.3.3' }))).text).toBe('plugin 0.3.3 enabled from /app/current/plugin')
    expect((await claudeCode.status(listed(plugin))).text).toBe('plugin 0.1.0 enabled from /app/current/plugin')
  })

  describe('service', () => {
    /** The plist on disk, `launchctl print` answering `print` (null: not loaded) and `sfltool dumpbtm` answering `dump` */
    function installed(print: string | null, dump: ExecResult) {
      const s = scratch()
      const ctx = context(s, fakeExec((cmd) => {
        if (cmd[0] === 'sfltool')
          return dump
        if (cmd[0] === 'launchctl' && cmd[1] === 'print')
          return print === null ? { code: 113, stdout: '', stderr: 'not found' } : ok(print)
        return undefined
      }).exec, { platform: 'darwin' })
      mkdirSync(ctx.launchAgents, { recursive: true })
      writeFileSync(plistPath(ctx), 'plist')
      return ctx
    }
    const running = '\tstate = running\n\tpid = 42\n'
    const fix = 'macOS blocks it at login: allow bun under System Settings → General → Login Items & Extensions'

    test('not loaded and disallowed at login: broken, pointing at Login Items', async () => {
      const ctx = installed(null, ok(btm(DISALLOWED)))
      expect(await serviceCheck(ctx)).toEqual({ label: 'service', text: `${plistPath(ctx)} is there, but ${fix}, then run golla setup`, broken: true })
    })

    test('running but disallowed at login: advice, not broken', async () => {
      expect(await serviceCheck(installed(running, ok(btm(DISALLOWED))))).toEqual({ label: 'service', text: `dev.gollabara.test running, pid 42, but ${fix}` })
    })

    test('allowed, or no Login Items answer: the plain texts', async () => {
      const failed = { code: 1, stdout: '', stderr: 'sfltool: command not found' }
      for (const dump of [ok(btm(ALLOWED)), failed, ok('garbage')]) {
        const ctx = installed(null, dump)
        expect(await serviceCheck(ctx)).toEqual({ label: 'service', text: `${plistPath(ctx)} is there but not loaded (golla setup)`, broken: true })
        expect(await serviceCheck(installed(running, dump))).toEqual({ label: 'service', text: 'dev.gollabara.test running, pid 42' })
      }
    })
  })

  test('tailscale: not running, running without serve, running with serve', () => {
    const down = { code: 1, stdout: '', stderr: 'failed to connect' }
    expect(tailscaleCheck(down, down).text).toBe('installed, not running, so other devices can\'t reach the stream')
    expect(tailscaleCheck(ok('{"BackendState":"NeedsLogin"}'), down).text).toBe('installed, NeedsLogin')
    expect(tailscaleCheck(ok('{"BackendState":"Running"}'), ok('{}')).text).toBe('running, no serve config')
    expect(tailscaleCheck(ok('{"BackendState":"Running"}'), ok('{"TCP":{"443":{"HTTPS":true}}}')).text).toBe('running, serve configured')
  })

  test('doctor lists the checks before the data dir and exits broken when one is broken', async () => {
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => Response.json({ version: '0.1.0', hooks: [] }) })
    try {
      const data = join(root, 'doctor-data')
      const url = `http://127.0.0.1:${server.port}`
      const advice = { label: 'sleep', text: 'never sleeps on power' }
      expect((await doctor({ url, dataDir: data, checks: async () => [advice] })).broken).toBe(false)
      const report = await doctor({ url, dataDir: data, checks: async () => [{ label: 'service', text: 'loaded but not running', broken: true }, advice] })
      expect(report.lines.slice(-3)).toEqual(['service   loaded but not running', 'sleep     never sleeps on power', `data      ${data}`])
      expect(report.broken).toBe(true)
    }
    finally {
      server.stop(true)
    }
  })
})
