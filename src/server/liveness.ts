// Which running sessions lost their harness process. A session-end event is the usual way a session ends,
// but a crash, a closed terminal or a killed process sends none: the server checks each linked pid instead.
import type { PidLink } from './store'
import process from 'node:process'

/** How often the server checks the linked pids; a session whose process went away is marked ended within this */
export const SWEEP_MS = 20_000

/** `ps` reports elapsed time in whole seconds, and the link lands after the process started; this covers both */
const START_SLACK_MS = 2000

/** What the sweep asks the system about processes */
export interface ProcessProbe {
  /** The pid is a running process this user may signal */
  alive: (pid: number) => boolean
  /** When each running pid's process started; pids the probe could not read are left out */
  startedAt: (pids: number[], now: number) => Map<number, number>
}

/**
 * Sessions whose process is gone: the pid answers no signal, or the process behind it started after the
 * session linked it, so the pid was reused (after a reboot, say). Links from before #76 carry no time and
 * get only the first check.
 */
export function goneSessions(links: PidLink[], probe: ProcessProbe, now = Date.now()): string[] {
  const gone: string[] = []
  const alive: PidLink[] = []
  for (const link of links) {
    if (probe.alive(link.pid))
      alive.push(link)
    else
      gone.push(link.id)
  }
  const timed = alive.filter(l => l.at !== null)
  if (!timed.length)
    return gone
  const started = probe.startedAt([...new Set(timed.map(l => l.pid))], now)
  for (const link of timed) {
    const at = started.get(link.pid)
    if (at !== undefined && at > link.at! + START_SLACK_MS)
      gone.push(link.id)
  }
  return gone
}

/** `ps` elapsed time, `[[dd-]hh:]mm:ss`, in ms; undefined when it does not parse */
export function parseElapsed(text: string): number | undefined {
  const match = /^(?:(?:(\d+)-)?(\d+):)?(\d+):(\d+)$/.exec(text.trim())
  if (!match)
    return undefined
  const [, days = '0', hours = '0', minutes, seconds] = match
  return (((Number(days) * 24 + Number(hours)) * 60 + Number(minutes!)) * 60 + Number(seconds!)) * 1000
}

/** The running system: a zero signal for liveness, one `ps` call for start times */
export const systemProbe: ProcessProbe = {
  alive(pid) {
    try {
      process.kill(pid, 0)
      return true
    }
    catch {
      // ESRCH: no such process. EPERM: another user's process, so not the session's harness
      return false
    }
  },
  startedAt(pids, now) {
    const out = new Map<number, number>()
    try {
      const ps = Bun.spawnSync(['ps', '-o', 'pid=,etime=', '-p', pids.join(',')], { stderr: 'ignore' })
      for (const line of ps.stdout.toString().split('\n')) {
        const [pid, elapsed] = line.trim().split(/\s+/)
        const ms = elapsed ? parseElapsed(elapsed) : undefined
        if (pid && ms !== undefined)
          out.set(Number(pid), now - ms)
      }
    }
    catch {
      // No `ps`: only the signal check holds
    }
    return out
  },
}
