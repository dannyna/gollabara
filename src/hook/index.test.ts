import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, describe, expect, test } from 'bun:test'
import stop from './fixtures/stop.json'
import { projectRoot, readBranch, readTail, stopTurnOpener } from './index'
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
    expect(readTail(path, 10)).toBe('aaaaaaaend')
    expect(readTail(path, 1 << 20)).toHaveLength(1003)
  })

  test('the opener comes from the transcript file', () => {
    expect(stopTurnOpener(join(import.meta.dir, 'fixtures', 'transcript-monitor.jsonl'))).toBe('system')
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

describe('GOLLABARA_HOOK=off', () => {
  // A local stand-in server on a free port; never the real one on 4747
  async function runEntry(env: Record<string, string>) {
    const hits: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        hits.push(new URL(req.url).pathname)
        return Response.json([])
      },
    })
    try {
      const proc = Bun.spawn(['bun', join(import.meta.dir, 'entry.ts')], {
        env: { ...process.env, GOLLABARA_URL: `http://127.0.0.1:${server.port}`, ...env },
        stdin: new TextEncoder().encode(JSON.stringify({ ...stop, transcript_path: undefined })),
        stdout: 'pipe',
      })
      const [exitCode, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
      return { exitCode, stdout, hits }
    }
    finally {
      server.stop(true)
    }
  }

  test('the hook exits at once without posting or claiming', async () => {
    expect(await runEntry({ GOLLABARA_HOOK: 'off' })).toEqual({ exitCode: 0, stdout: '', hits: [] })
  })

  test('without it the same Stop posts the recap and claims feedback', async () => {
    const { exitCode, hits } = await runEntry({ GOLLABARA_HOOK: '' })
    expect(exitCode).toBe(0)
    expect(hits.sort()).toEqual(['/api/events', '/api/feedback/claim'])
  })
})
