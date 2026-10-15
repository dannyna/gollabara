#!/usr/bin/env bun
// golla — gollabara CLI
import process from 'node:process'
import { runHook } from './hook'
import { runWait } from './hook/wait'
import { startServer } from './server'

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
  default:
    console.log(`Usage:
  golla serve       start the stream server
  golla hook        send Claude Code hook input (stdin) to the server
  golla hook wait   wait for the user's feedback after a Stop, and wake the idle session with it`)
}
