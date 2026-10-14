import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export const DEFAULT_PORT = 4747

export function serverPort(): number {
  return Number(process.env.GOLLABARA_PORT ?? DEFAULT_PORT)
}

/** hook 이 이벤트를 보낼 서버. 다른 컴퓨터의 세션은 이 값만 바꾸면 된다. */
export function serverUrl(): string {
  return process.env.GOLLABARA_URL ?? `http://127.0.0.1:${serverPort()}`
}

export function dataDir(): string {
  return process.env.GOLLABARA_DATA ?? join(homedir(), '.gollabara', 'data')
}
