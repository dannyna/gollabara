// The Codex CLI harness for `golla setup`. Codex reads Claude-style plugins (`.claude-plugin/plugin.json`
// and `marketplace.json`) but needs its own hooks, and its hooks get codex's env with no login shell, so `bun`
// is on PATH only by luck. Setup renders the hooks with an absolute bun path into a local marketplace outside
// the repo, then registers it with `codex plugin marketplace add` and installs the plugin from it.
//
// Codex trusts each hook by the hash of its definition (the command before `${PLUGIN_ROOT}` expands, and the
// timeout) and by its position, so the commands, their order and their timeouts here must not change.

import type { Context } from './context'
import type { Check, Harness } from './harness'
import { copyFileSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { currentDir, found } from './context'

/** Marketplace and plugin name; the trust key is `gollabara@gollabara:hooks/hooks.json:<event>:<group>:<handler>` */
export const CODEX_PLUGIN = 'gollabara@gollabara'
const MARKETPLACE = 'gollabara'

/** Where setup writes the local marketplace Codex installs from */
export const codexStage = (ctx: Pick<Context, 'home'>) => join(ctx.home, 'codex')

/**
 * Codex hooks.json for an absolute bun path. Every handler runs the shared bundle with the `codex`
 * argument, which is how the hook knows its harness. Timeouts are Codex's backstop only: the hook ends
 * itself within 2.5 s (its 1.5 s request budget plus a hard deadline), and SessionEnd within 1 s once
 * its input is read (a 750 ms request budget). Codex clamps SessionEnd to 3 s; it is registered now so
 * lifecycle work (#76) changes only the script, never the definition.
 */
export function codexHooks(bun: string): object {
  const command = `"${bun}" "\${PLUGIN_ROOT}/bin/hook.js" codex`
  const handler = (timeout: number) => [{ hooks: [{ type: 'command', command, timeout }] }]
  return {
    hooks: {
      SessionStart: handler(5),
      UserPromptSubmit: handler(5),
      PreToolUse: [{ matcher: 'request_user_input', hooks: [{ type: 'command', command, timeout: 5 }] }],
      PostToolUse: handler(5),
      Stop: handler(5),
      SessionEnd: handler(3),
    },
  }
}

async function run(ctx: Context, args: string[]): Promise<string> {
  const res = await ctx.exec([ctx.codex, 'plugin', ...args])
  if (res.code !== 0)
    throw new Error(`codex plugin ${args.join(' ')} failed: ${(res.stderr || res.stdout).trim().split('\n')[0]}`)
  return res.stdout
}

/**
 * The bun the hooks run. `process.execPath` is resolved, a versioned Cellar path under Homebrew that the next
 * upgrade removes and whose change would void the hooks' trust, so the PATH spelling wins when it is the same binary.
 */
export function hookBun(ctx: Pick<Context, 'bun'>): string {
  const onPath = Bun.which('bun')
  try {
    return onPath && realpathSync(onPath) === realpathSync(ctx.bun) ? onPath : ctx.bun
  }
  catch {
    return ctx.bun
  }
}

interface CodexPlugin { pluginId: string, version?: string, enabled?: boolean }

async function installedPlugin(ctx: Context): Promise<CodexPlugin | undefined> {
  const { installed = [] } = JSON.parse(await run(ctx, ['list', '--json'])) as { installed?: CodexPlugin[] }
  return installed.find(p => p.pluginId === CODEX_PLUGIN)
}

/**
 * Codex copies an installed plugin into its own cache, so `${PLUGIN_ROOT}` never follows `app/current`: each
 * setup (and so each update) rewrites the stage from the installed app and adds the plugin again, which
 * refreshes the cached copy. CODEX_HOME is honored through the environment the codex commands inherit.
 */
export const codex: Harness = {
  id: 'codex',
  name: 'Codex CLI',
  detect: ctx => found(ctx.codex),
  async install(ctx) {
    const stage = codexStage(ctx)
    writeStage(stage, join(currentDir(ctx), 'plugin'), hookBun(ctx))
    await run(ctx, ['marketplace', 'add', stage])
    await run(ctx, ['add', CODEX_PLUGIN])
    return `plugin ${CODEX_PLUGIN} from ${join(stage, 'plugin')}; open codex once and approve "Hooks need review" for gollabara (until then codex exec skips its hooks silently)`
  },
  async uninstall(ctx) {
    const removed: string[] = []
    if (await installedPlugin(ctx)) {
      await run(ctx, ['remove', CODEX_PLUGIN])
      removed.push(`plugin ${CODEX_PLUGIN}`)
    }
    const { marketplaces = [] } = JSON.parse(await run(ctx, ['marketplace', 'list', '--json'])) as { marketplaces?: { name: string }[] }
    if (marketplaces.some(m => m.name === MARKETPLACE)) {
      await run(ctx, ['marketplace', 'remove', MARKETPLACE])
      removed.push(`marketplace ${MARKETPLACE}`)
    }
    rmSync(codexStage(ctx), { recursive: true, force: true })
    return removed.length ? `removed ${removed.join(' and ')}` : 'nothing installed'
  },
  async status(ctx): Promise<Check> {
    const label = this.id
    if (!found(ctx.codex))
      return { label, text: `${ctx.codex} not found, so no plugin to check` }
    try {
      const plugin = await installedPlugin(ctx)
      if (!plugin)
        return { label, text: `plugin ${CODEX_PLUGIN} not installed (golla setup)`, broken: true }
      return { label, text: `plugin ${plugin.version ?? '?'} ${plugin.enabled === false ? 'disabled' : 'enabled'} from ${join(codexStage(ctx), 'plugin')}` }
    }
    catch (error) {
      return { label, text: error instanceof Error ? error.message : String(error), broken: true }
    }
  },
}

/** The local marketplace: its manifest, the plugin manifest (shared version), the hook bundle, and the rendered hooks */
export function writeStage(stage: string, pluginDir: string, bun: string): void {
  const plugin = join(stage, 'plugin')
  for (const dir of [join(stage, '.claude-plugin'), join(plugin, '.claude-plugin'), join(plugin, 'bin'), join(plugin, 'hooks')])
    mkdirSync(dir, { recursive: true })
  const manifest = JSON.parse(readFileSync(join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8'))
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
  writeFileSync(join(stage, '.claude-plugin', 'marketplace.json'), json({
    name: 'gollabara',
    owner: { name: 'gollabara' },
    plugins: [{ name: 'gollabara', source: './plugin', description: manifest.description }],
  }))
  writeFileSync(join(plugin, '.claude-plugin', 'plugin.json'), json(manifest))
  copyFileSync(join(pluginDir, 'bin', 'hook.js'), join(plugin, 'bin', 'hook.js'))
  writeFileSync(join(plugin, 'hooks', 'hooks.json'), json(codexHooks(bun)))
}
