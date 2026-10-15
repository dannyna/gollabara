#!/usr/bin/env bun
// golla — gollabara CLI
import process from 'node:process'
import { doctor } from './doctor'
import { runHook } from './hook'
import { runWait } from './hook/wait'
import { startServer } from './server'
import { dataDir, serverUrl } from './shared/config'

const [command, mode] = process.argv.slice(2)

switch (command) {
  case 'serve':
    startServer()
    break
  case 'hook':
    if (mode === 'wait')
      process.exit(await runWait())
    await runHook()
    process.exit(0)
    break
  case 'doctor':
    console.log((await doctor({ url: serverUrl(), dataDir: dataDir() })).join('\n'))
    break
  default:
    console.log(`Usage:
  golla serve       start the stream server
  golla hook        send Claude Code hook input (stdin) to the server
  golla hook wait   wait for the user's feedback after a Stop, and wake the idle session with it
  golla doctor      check the server, the plugin version each harness runs, and hook health`)
}
