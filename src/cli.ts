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
  default:
    console.log(`사용법:
  golla serve   스트림 서버를 띄운다
  golla hook    Claude Code hook 입력(stdin)을 서버로 보낸다`)
}
