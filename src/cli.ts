#!/usr/bin/env bun
// golla — gollabara CLI
import process from 'node:process'
import { runHook } from './hook'
import { startServer } from './server'

const [command] = process.argv.slice(2)

switch (command) {
  case 'serve':
    startServer()
    break
  case 'hook':
    await runHook()
    process.exit(0)
    break
  default:
    console.log(`Usage:
  golla serve   start the stream server
  golla hook    send Claude Code hook input (stdin) to the server`)
}
