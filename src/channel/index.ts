// `plugin/bin/channel.js`: the stdio MCP server that pushes the user's feedback into an idle session.
// Never crashes the session: every error is swallowed and retried later. Stdout carries protocol frames only.

import type { Feedback } from '../shared/types'
import process from 'node:process'
import { serverUrl } from '../shared/config'
import { channelEnabled, feedbackNotification, respond } from './protocol'

/** Longer than the server's 25 s wait, so a healthy poll never times out here */
const POLL_TIMEOUT_MS = 35_000
/** SessionStart may not have linked the pid yet */
const UNLINKED_RETRY_MS = 2_000
/** The gollabara server is down or refused the poll */
const ERROR_RETRY_MS = 10_000

export function runChannel(): void {
  // Claude Code spawned this process; its pid is what the session's SessionStart reported
  const pid = process.ppid
  const enabled = process.env.GOLLABARA_HOOK !== 'off' && channelEnabled(parentArgs(pid))
  let polling = false
  // The one stderr line: Claude Code keeps it in its MCP debug log
  console.error(enabled ? 'gollabara channel: on' : 'gollabara channel: off (Claude Code was not started with this plugin as a channel)')

  // Claude Code gone (stdin closed, or stdout broken): stop, so an orphan never claims feedback
  process.stdin.on('end', () => process.exit(0))
  process.stdin.on('close', () => process.exit(0))
  process.stdout.on('error', () => process.exit(0))

  let buffer = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    for (let i = buffer.indexOf('\n'); i >= 0; i = buffer.indexOf('\n')) {
      const line = buffer.slice(0, i).trim()
      buffer = buffer.slice(i + 1)
      if (!line)
        continue
      let message: any
      try {
        message = JSON.parse(line)
      }
      catch {
        continue
      }
      const reply = respond(message)
      if (reply)
        write(reply)
      // Events sent before the handshake completes would be lost
      if (message?.method === 'notifications/initialized' && enabled && !polling) {
        polling = true
        void poll(pid)
      }
    }
  })
}

async function poll(pid: number): Promise<never> {
  for (;;) {
    if (process.ppid !== pid)
      process.exit(0)
    let wait = 0
    try {
      const res = await fetch(`${serverUrl()}/api/channel/wait?pid=${pid}`, { signal: AbortSignal.timeout(POLL_TIMEOUT_MS) })
      if (res.ok) {
        const items = await res.json() as Feedback[]
        if (Array.isArray(items) && items.length)
          write(feedbackNotification(items))
      }
      else {
        wait = res.status === 404 ? UNLINKED_RETRY_MS : ERROR_RETRY_MS
      }
    }
    catch {
      wait = ERROR_RETRY_MS
    }
    if (wait)
      await Bun.sleep(wait)
  }
}

function write(frame: object): void {
  try {
    process.stdout.write(`${JSON.stringify(frame)}\n`)
  }
  catch {
    process.exit(0)
  }
}

/** The parent's command line, or '' when it can't be read (then the channel stays off) */
function parentArgs(pid: number): string {
  try {
    return Bun.spawnSync(['ps', '-o', 'args=', '-p', String(pid)]).stdout.toString()
  }
  catch {
    return ''
  }
}
