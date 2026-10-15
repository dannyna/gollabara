import type { Context, Exec, ExecResult } from './context'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'bun:test'
import { codex, CODEX_PLUGIN, codexHooks, codexStage, hookBun } from './codex'
import { currentDir } from './context'

const BUN = '/opt/homebrew/bin/bun'
const COMMAND = `"${BUN}" "\${PLUGIN_ROOT}/bin/hook.js" codex`
const root = mkdtempSync(join(tmpdir(), 'gollabara-codex-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const ok = (stdout = ''): ExecResult => ({ code: 0, stdout, stderr: '' })

let n = 0
/** An installed app (its plugin manifest and hook bundle under app/current) and a `codex` binary that exists */
function scratch(answer: (args: string) => ExecResult | undefined = () => undefined) {
  const dir = join(root, String(n++))
  const plugin = join(dir, 'home', 'app', 'current', 'plugin')
  mkdirSync(join(plugin, '.claude-plugin'), { recursive: true })
  mkdirSync(join(plugin, 'bin'), { recursive: true })
  writeFileSync(join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'gollabara', version: '9.9.9', description: 'd' }))
  writeFileSync(join(plugin, 'bin', 'hook.js'), 'hook bundle')
  const bin = join(dir, 'codex')
  writeFileSync(bin, '')
  const calls: string[] = []
  const exec: Exec = async (cmd) => {
    const args = cmd.slice(1).join(' ')
    calls.push(args)
    return answer(args) ?? ok()
  }
  const ctx = { home: join(dir, 'home'), codex: bin, bun: BUN, exec } as unknown as Context
  return { ctx, calls }
}

describe('Codex hooks.json', () => {
  // Codex trusts each handler by the hash of its definition and by its position: any change here
  // (command, order, matcher, timeout) makes users approve the hooks again
  test('is pinned: events, order, matchers, commands and timeouts', () => {
    const handler = (timeout: number) => [{ hooks: [{ type: 'command', command: COMMAND, timeout }] }]
    expect(JSON.stringify(codexHooks(BUN))).toBe(JSON.stringify({
      hooks: {
        SessionStart: handler(5),
        UserPromptSubmit: handler(5),
        PreToolUse: [{ matcher: 'request_user_input', hooks: [{ type: 'command', command: COMMAND, timeout: 5 }] }],
        PostToolUse: handler(5),
        Stop: handler(5),
        SessionEnd: handler(3),
      },
    }))
  })
})

describe('the Codex harness', () => {
  test('stages a local marketplace from app/current with an absolute bun path, then adds and installs it', async () => {
    const { ctx, calls } = scratch()
    const stage = codexStage(ctx)
    const text = await codex.install(ctx)
    expect(calls).toEqual([`plugin marketplace add ${stage}`, `plugin add ${CODEX_PLUGIN}`])
    const read = (path: string) => JSON.parse(readFileSync(join(stage, path), 'utf8'))
    expect(read('.claude-plugin/marketplace.json')).toMatchObject({ name: 'gollabara', plugins: [{ name: 'gollabara', source: './plugin' }] })
    expect(read('plugin/.claude-plugin/plugin.json')).toMatchObject({ name: 'gollabara', version: '9.9.9' })
    expect(read('plugin/hooks/hooks.json')).toEqual(codexHooks(BUN))
    expect(readFileSync(join(stage, 'plugin/bin/hook.js'), 'utf8')).toBe(readFileSync(join(currentDir(ctx), 'plugin/bin/hook.js'), 'utf8'))
    expect(text).toContain('Hooks need review')
  })

  test('a failed install throws with codex\'s first line', async () => {
    const { ctx } = scratch(args => args.startsWith('plugin add') ? { code: 1, stdout: '', stderr: 'plugin not found\nmore' } : undefined)
    await expect(codex.install(ctx)).rejects.toThrow(`codex plugin add ${CODEX_PLUGIN} failed: plugin not found`)
  })

  test('uninstall removes the plugin, the marketplace and the stage', async () => {
    const { ctx, calls } = scratch((args) => {
      if (args === 'plugin list --json')
        return ok(JSON.stringify({ installed: [{ pluginId: CODEX_PLUGIN, version: '0.1.0', enabled: true }] }))
      if (args === 'plugin marketplace list --json')
        return ok(JSON.stringify({ marketplaces: [{ name: 'openai-api-curated' }, { name: 'gollabara' }] }))
      return undefined
    })
    await codex.install(ctx)
    calls.length = 0
    expect(await codex.uninstall(ctx)).toBe(`removed plugin ${CODEX_PLUGIN} and marketplace gollabara`)
    expect(calls).toEqual(['plugin list --json', `plugin remove ${CODEX_PLUGIN}`, 'plugin marketplace list --json', 'plugin marketplace remove gollabara'])
    expect(existsSync(codexStage(ctx))).toBe(false)
  })

  test('the hooks run the PATH spelling of the same bun, and the resolved path otherwise', () => {
    const onPath = Bun.which('bun')!
    expect(hookBun({ bun: realpathSync(onPath) })).toBe(onPath)
    expect(hookBun({ bun: BUN })).toBe(BUN)
  })

  test('status reads codex plugin list', async () => {
    const listed = (installed: unknown[]) => scratch(args => args === 'plugin list --json' ? ok(JSON.stringify({ installed })) : undefined).ctx
    expect(await codex.status(listed([{ pluginId: CODEX_PLUGIN, version: '0.1.0', enabled: true }]))).toMatchObject({ label: 'codex', text: expect.stringMatching(/^plugin 0\.1\.0 enabled from /) })
    expect(await codex.status(listed([]))).toMatchObject({ broken: true, text: `plugin ${CODEX_PLUGIN} not installed (golla setup)` })
    const missing = { ...listed([]), codex: join(root, 'no-codex') }
    expect(await codex.status(missing)).toEqual({ label: 'codex', text: `${missing.codex} not found, so no plugin to check` })
  })
})
