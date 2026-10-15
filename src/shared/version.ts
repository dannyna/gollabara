// The plugin version, baked into plugin/bin/hook.js at build time. Hooks send it with every request so the
// server can tell an outdated plugin; the server, running from source, expects the same file's version.

import plugin from '../../plugin/.claude-plugin/plugin.json'

export const PLUGIN_VERSION: string = plugin.version

/** Request headers every hook sends; hooks from before the handshake send neither */
export const HOOK_VERSION_HEADER = 'x-gollabara-hook'
export const HOOK_HARNESS_HEADER = 'x-gollabara-harness'

/** Negative when `a` is older than `b`. Dotted numeric versions; a pre-release suffix is ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split('-')[0]!.split('.').map(n => Number.parseInt(n, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d)
      return d
  }
  return 0
}

/** Whether a hook that sent `version` (null: no header, a hook from before the handshake) is older than `expected` */
export function hookOutdated(version: string | null, expected = PLUGIN_VERSION): boolean {
  return version === null || compareVersions(version, expected) < 0
}
