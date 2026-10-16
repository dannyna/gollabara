// Harnesses `golla setup` connects. Each one is detected on this machine and gets its plugin installed from
// the stable install path, so the plugin keeps working after a `git pull` or a bunx cache eviction.

import type { Context } from './context'
import { join } from 'node:path'
import { codex } from './codex'
import { currentDir, found } from './context'

export interface Check {
  label: string
  text: string
  /** Something the user has to fix; `golla doctor` exits non-zero */
  broken?: boolean
}

export interface Harness {
  /** Row label in setup, uninstall and doctor output */
  id: string
  name: string
  detect: (ctx: Context) => boolean
  /** Installs or refreshes the plugin; returns what is connected, throws with the reason otherwise */
  install: (ctx: Context) => Promise<string>
  /** Removes the plugin and its marketplace entry; returns what was removed */
  uninstall: (ctx: Context) => Promise<string>
  status: (ctx: Context) => Promise<Check>
}

const MARKETPLACE = 'gollabara'
const PLUGIN_ID = 'gollabara@gollabara'

interface InstalledPlugin { id: string, version?: string, enabled?: boolean, readFromFolder?: string, folderVersion?: string }
interface Marketplace { name: string, path?: string }

async function listJson<T>(ctx: Context, args: string[]): Promise<T[]> {
  const res = await ctx.exec([ctx.claude, 'plugin', ...args, '--json'])
  if (res.code !== 0)
    throw new Error(`claude plugin ${args.join(' ')} failed: ${(res.stderr || res.stdout).trim()}`)
  return JSON.parse(res.stdout) as T[]
}

async function run(ctx: Context, args: string[]): Promise<void> {
  const res = await ctx.exec([ctx.claude, 'plugin', ...args])
  if (res.code !== 0)
    throw new Error(`claude plugin ${args.join(' ')} failed: ${(res.stderr || res.stdout).trim()}`)
}

/**
 * Claude Code reads a directory marketplace's plugin in place, so the marketplace points at `app/current`:
 * switching that symlink updates the plugin at the next session start. `marketplace add` with the same name
 * repoints an existing entry (an earlier checkout, say), and `install` is a no-op when already installed.
 */
export const claudeCode: Harness = {
  id: 'claude',
  name: 'Claude Code',
  detect: ctx => found(ctx.claude),
  async install(ctx) {
    const dir = currentDir(ctx)
    await run(ctx, ['marketplace', 'add', dir])
    await run(ctx, ['install', PLUGIN_ID])
    return `plugin ${PLUGIN_ID} from ${join(dir, 'plugin')}`
  },
  async uninstall(ctx) {
    const removed: string[] = []
    if ((await listJson<InstalledPlugin>(ctx, ['list'])).some(p => p.id === PLUGIN_ID)) {
      await run(ctx, ['uninstall', PLUGIN_ID])
      removed.push(`plugin ${PLUGIN_ID}`)
    }
    if ((await listJson<Marketplace>(ctx, ['marketplace', 'list'])).some(m => m.name === MARKETPLACE)) {
      await run(ctx, ['marketplace', 'remove', MARKETPLACE])
      removed.push(`marketplace ${MARKETPLACE}`)
    }
    return removed.length ? `removed ${removed.join(' and ')}` : 'nothing installed'
  },
  async status(ctx) {
    const label = this.id
    if (!found(ctx.claude))
      return { label, text: `${ctx.claude} not found, so no plugin to check` }
    try {
      const plugin = (await listJson<InstalledPlugin>(ctx, ['list'])).find(p => p.id === PLUGIN_ID)
      if (!plugin)
        return { label, text: `plugin ${PLUGIN_ID} not installed (golla setup)`, broken: true }
      const from = plugin.readFromFolder ? ` from ${plugin.readFromFolder}` : ''
      // A directory marketplace's plugin runs from the folder, so its version is the folder's, not the
      // one recorded at first install
      const version = plugin.folderVersion ?? plugin.version ?? '?'
      return { label, text: `plugin ${version} ${plugin.enabled === false ? 'disabled' : 'enabled'}${from}` }
    }
    catch (error) {
      return { label, text: error instanceof Error ? error.message : String(error), broken: true }
    }
  },
}

/** Every harness setup knows */
export const HARNESSES: Harness[] = [claudeCode, codex]
