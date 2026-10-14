import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export const DEFAULT_PORT = 4747

export function serverPort(): number {
  return Number(process.env.GOLLABARA_PORT ?? DEFAULT_PORT)
}

/** Server the hook sends events to. Sessions on another machine only need to change this. */
export function serverUrl(): string {
  return process.env.GOLLABARA_URL ?? `http://127.0.0.1:${serverPort()}`
}

export function dataDir(): string {
  return process.env.GOLLABARA_DATA ?? join(homedir(), '.gollabara', 'data')
}
