import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'bun:test'
import { projectRoot, readBranch } from './index'
import { sessionInfo } from './map'

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
