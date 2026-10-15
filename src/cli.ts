#!/usr/bin/env bun
// golla — gollabara CLI
import process from 'node:process'
import { parseArgs } from 'node:util'
import { doctor } from './doctor'
import { runHook } from './hook'
import { runWait } from './hook/wait'
import { startServer } from './server'
import { systemChecks } from './setup/checks'
import { resolveContext } from './setup/context'
import { setup, uninstall, update } from './setup/index'

const [command, ...rest] = process.argv.slice(2)

function flags() {
  const { values } = parseArgs({
    args: rest,
    options: { 'port': { type: 'string' }, 'no-service': { type: 'boolean' }, 'keep-data': { type: 'boolean' } },
  })
  const port = values.port === undefined ? undefined : Number(values.port)
  if (port !== undefined && !(Number.isInteger(port) && port > 0 && port < 65536))
    throw new Error(`--port ${values.port} is not a port`)
  return { port, service: !values['no-service'], keepData: !!values['keep-data'] }
}

function print({ lines, ok }: { lines: string[], ok: boolean }): never {
  if (lines.length)
    console.log(lines.join('\n'))
  process.exit(ok ? 0 : 1)
}

switch (command) {
  case 'serve':
    startServer()
    break
  case 'hook':
    if (rest[0] === 'wait')
      process.exit(await runWait())
    await runHook(rest[0] === 'codex' ? 'codex' : 'claude-code')
    process.exit(0)
    break
  case 'doctor': {
    const ctx = resolveContext()
    const report = await doctor({ url: process.env.GOLLABARA_URL ?? `http://127.0.0.1:${ctx.port}`, dataDir: ctx.dataDir, checks: () => systemChecks(ctx) })
    print({ lines: report.lines, ok: !report.broken })
    break
  }
  case 'setup': {
    const { port, service } = flags()
    print(await setup(resolveContext({ port }), { service }))
    break
  }
  case 'update':
    print(await update(resolveContext()))
    break
  case 'uninstall':
    print(await uninstall(resolveContext(), { keepData: flags().keepData }))
    break
  default:
    console.log(`Usage:
  golla setup        install the app, the login service (macOS) and each detected harness's plugin
                       --port <n>      serve on this port (default 4747)
                       --no-service    skip the login service
  golla doctor       check the server, the service, plugins, hook health, sleep and Tailscale
  golla update       refresh to the latest (npm, or the checkout setup ran from), then set up again
  golla uninstall    remove the service, the plugins, the app and the data
                       --keep-data     keep the messages and images
  golla serve        start the stream server
  golla hook         send Claude Code hook input (stdin) to the server
  golla hook codex   send Codex CLI hook input (stdin) to the server
  golla hook wait    wait for the user's feedback after a Stop, and wake the idle session with it`)
}
