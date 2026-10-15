import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, describe, expect, test } from 'bun:test'
import { doctor } from '../doctor'
import { PLUGIN_VERSION } from '../shared/version'
import postReadImage from './fixtures/post-read-image.json'
import stop from './fixtures/stop.json'
import { readHealth } from './health'
import { projectRoot, readBranch, readFileRole, readTail, stopTurnOpener, turnStart } from './index'
import { mapHook, sessionInfo } from './map'

const base = realpathSync(mkdtempSync(join(tmpdir(), 'gollabara-hook-')))
afterAll(() => rmSync(base, { recursive: true, force: true }))

function dir(...parts: string[]): string {
  const path = join(base, ...parts)
  mkdirSync(path, { recursive: true })
  return path
}

const name = (cwd: string) => sessionInfo({ hook_event_name: 'Stop', session_id: 's1', cwd }, {}, { projectRoot, readBranch }).name

describe('project root and branch from the filesystem', () => {
  test('a nested cwd resolves to the clone root and its branch', () => {
    const root = dir('piuda')
    writeFileSync(join(dir('piuda', '.git'), 'HEAD'), 'ref: refs/heads/feat/e2e\n')
    const nested = dir('piuda', 'apps', 'e2e-desktop')
    expect(projectRoot(nested)).toBe(root)
    expect(name(nested)).toBe('piuda · feat/e2e')
    expect(name(root)).toBe('piuda · feat/e2e')
  })

  test('a worktree `.git` file is followed to its gitdir for the branch', () => {
    const gitDir = dir('main-clone', '.git', 'worktrees', 'wt')
    writeFileSync(join(gitDir, 'HEAD'), 'ref: refs/heads/fix/stable-name\n')
    const root = dir('wt')
    writeFileSync(join(root, '.git'), `gitdir: ${gitDir}\n`)
    expect(projectRoot(dir('wt', 'src'))).toBe(root)
    expect(name(dir('wt', 'src'))).toBe('wt · fix/stable-name')
  })

  test('a relative gitdir (submodule) resolves against the root', () => {
    writeFileSync(join(dir('super', '.git', 'modules', 'sub'), 'HEAD'), 'ref: refs/heads/feat/sub\n')
    writeFileSync(join(dir('super', 'sub'), '.git'), 'gitdir: ../.git/modules/sub\n')
    expect(name(dir('super', 'sub', 'lib'))).toBe('sub · feat/sub')
  })

  test('without any git the cwd itself names the session', () => {
    const plain = dir('plain', 'nested')
    expect(projectRoot(plain)).toBe(plain)
    expect(readBranch(plain)).toBeUndefined()
    expect(name(plain)).toBe('nested')
  })
})

describe('transcript tail on Stop', () => {
  test('reads only the last bytes of the file', () => {
    const path = join(dir('tail'), 'session.jsonl')
    writeFileSync(path, `${'a'.repeat(1000)}end`)
    expect(readTail(path, 10)).toEqual({ text: 'aaaaaaaend', whole: false })
    expect(readTail(path, 1 << 20)).toMatchObject({ whole: true })
  })

  test('the opener comes from the transcript file', () => {
    expect(stopTurnOpener(join(import.meta.dir, 'fixtures', 'transcript-monitor.jsonl'))).toBe('system')
  })

  test('a screenshot-heavy turn widens the window until it reaches the opener', () => {
    const path = join(dir('tail'), 'screenshots.jsonl')
    const screenshot = JSON.stringify({ type: 'user', message: { content: [{ type: 'image', source: { data: 'A'.repeat(300 * 1024) } }] } })
    writeFileSync(path, `${readFileSync(join(import.meta.dir, 'fixtures', 'transcript-monitor.jsonl'), 'utf8')}${screenshot}\n`)
    expect(stopTurnOpener(path, [256 * 1024])).toBe('unknown')
    expect(stopTurnOpener(path)).toBe('system')
  })

  test('an unreadable or missing transcript falls back to posting the recap', () => {
    const opener = stopTurnOpener(join(base, 'missing.jsonl'))
    expect(opener).toBe('unknown')
    expect(stopTurnOpener(undefined)).toBe('unknown')
    expect(stopTurnOpener(dir('a-directory'))).toBe('unknown')
    const session = { id: 's1', name: 'piuda', harness: 'claude-code' as const, cwd: '/x' }
    expect(mapHook(stop, session, opener)).toMatchObject({ kind: 'recap' })
  })
})

describe('image role from the file\'s mtime', () => {
  const fixture = (name: string) => join(import.meta.dir, 'fixtures', name)
  // transcript-human.jsonl: the current turn opened at this time
  const opened = Date.parse('2026-10-13T14:54:48.567Z')
  function image(name: string, mtime: number) {
    const path = join(dir('images'), name)
    writeFileSync(path, 'png')
    utimesSync(path, mtime / 1000, mtime / 1000)
    return path
  }

  test('a file from before the turn is a reference, one written during it an artifact', () => {
    expect(turnStart(fixture('transcript-human.jsonl'))).toBe(opened)
    expect(readFileRole(image('mock.png', opened - 60_000), fixture('transcript-human.jsonl'))).toBe('reference')
    expect(readFileRole(image('shot.png', opened + 5_000), fixture('transcript-human.jsonl'))).toBe('artifact')
  })

  test('without the opener in reach the session start decides', () => {
    const path = join(dir('tail'), 'no-opener.jsonl')
    writeFileSync(path, '{"type":"queue-operation","timestamp":"2026-10-13T10:00:00.000Z"}\n{"type":"assistant","timestamp":"2026-10-13T10:05:00.000Z"}\n')
    const started = Date.parse('2026-10-13T10:00:00.000Z')
    expect(turnStart(path)).toBe(started)
    expect(readFileRole(image('older.png', started - 1), path)).toBe('reference')
    expect(readFileRole(image('newer.png', started + 1), path)).toBe('artifact')
  })

  test('an unreadable transcript or file makes the image an artifact', () => {
    const old = image('old.png', opened - 60_000)
    expect(readFileRole(old, undefined)).toBe('artifact')
    expect(readFileRole(old, join(base, 'missing.jsonl'))).toBe('artifact')
    expect(readFileRole(old, dir('a-directory'))).toBe('artifact')
    expect(readFileRole(join(base, 'missing.png'), fixture('transcript-human.jsonl'))).toBe('artifact')
  })
})

// A local stand-in server on a free port; never the real one on 4747. The health log goes to a scratch data dir.
async function runEntry(env: Record<string, string>, input: object = { ...stop, transcript_path: undefined }, answer = true) {
  const hits: string[] = []
  const events: any[] = []
  const headers: Record<string, string | null>[] = []
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      hits.push(new URL(req.url).pathname)
      headers.push({ hook: req.headers.get('x-gollabara-hook'), harness: req.headers.get('x-gollabara-harness') })
      if (new URL(req.url).pathname === '/api/events')
        events.push(await req.json())
      // A server that never answers: the hook's own timeout ends the request
      if (!answer)
        await new Promise(() => {})
      return Response.json([])
    },
  })
  try {
    const proc = Bun.spawn(['bun', join(import.meta.dir, 'entry.ts')], {
      env: { ...process.env, GOLLABARA_URL: `http://127.0.0.1:${server.port}`, GOLLABARA_DATA: dir('data'), ...env },
      stdin: new TextEncoder().encode(JSON.stringify(input)),
      stdout: 'pipe',
    })
    const [exitCode, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
    return { exitCode, stdout, hits, events, headers }
  }
  finally {
    server.stop(true)
  }
}

describe('GOLLABARA_HOOK=off', () => {
  test('the hook exits at once without posting or claiming', async () => {
    expect(await runEntry({ GOLLABARA_HOOK: 'off' })).toEqual({ exitCode: 0, stdout: '', hits: [], events: [], headers: [] })
  })

  test('without it the same Stop posts the recap and claims feedback', async () => {
    const { exitCode, hits } = await runEntry({ GOLLABARA_HOOK: '' })
    expect(exitCode).toBe(0)
    expect(hits.sort()).toEqual(['/api/events', '/api/feedback/claim'])
  })

  test('a Read of a file from before the turn posts its image as a reference', async () => {
    const mock = join(dir('entry'), 'mock.png')
    writeFileSync(mock, 'png')
    utimesSync(mock, new Date('2026-10-13T14:00:00Z'), new Date('2026-10-13T14:00:00Z'))
    const transcript = join(import.meta.dir, 'fixtures', 'transcript-human.jsonl')
    const { events } = await runEntry({ GOLLABARA_HOOK: '' }, { ...postReadImage, tool_input: { file_path: mock }, transcript_path: transcript })
    expect(events).toMatchObject([{ kind: 'image', images: [{ source: mock, role: 'reference' }] }])
  })
})

describe('version handshake and health log', () => {
  test('every request names the plugin version and the harness', async () => {
    const { headers } = await runEntry({ GOLLABARA_HOOK: '', GOLLABARA_DATA: dir('data-headers') })
    expect(headers).toEqual([
      { hook: PLUGIN_VERSION, harness: 'claude-code' },
      { hook: PLUGIN_VERSION, harness: 'claude-code' },
    ])
    expect(readHealth(dir('data-headers'))).toMatchObject([{ event: 'Stop', harness: 'claude-code', ok: true }])
  })

  test('a hook whose server never answers exits 0 at its timeout, and doctor shows it with its latency', async () => {
    const data = dir('data-timeout')
    const { exitCode } = await runEntry({ GOLLABARA_HOOK: '', GOLLABARA_DATA: data }, undefined, false)
    expect(exitCode).toBe(0)
    const [entry] = readHealth(data)
    expect(entry).toMatchObject({ event: 'Stop', harness: 'claude-code', ok: false, error: 'timeout' })
    expect(entry!.ms).toBeGreaterThanOrEqual(1500)
    expect(entry!.ms).toBeLessThan(3000)
    const report = (await doctor({ url: 'http://127.0.0.1:9', dataDir: data })).join('\n')
    expect(report).toContain(`Stop (claude-code) timeout after ${entry!.ms} ms`)
    expect(report).toContain('failures  1 logged')
  })
})
