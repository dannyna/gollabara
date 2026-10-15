// 플러그인에 번들되는 hook 진입점 (plugin/bin/hook.js). 플러그인은 캐시로 복사되므로 자체 완결이어야 한다.
import process from 'node:process'
import { runHook } from './index'
import { runWait } from './wait'

/**
 * A hard deadline for every mode but `wait`: past the 1.5 s request budget, whatever still runs (a slow
 * transcript read, a stalled stdin) is cut and the hook exits 0, before the harness's own timeout kills
 * it and reports a failure (Codex shows that in its TUI).
 */
const HARD_DEADLINE_MS = 2500

const mode = process.argv[2]
if (mode !== 'wait')
  setTimeout(() => process.exit(0), HARD_DEADLINE_MS).unref()

// Bundle entry point: top-level await waits for the hook to finish before exiting.
// `hook.js wait` is the wake-up Stop hook, the one mode that may exit non-zero (2 wakes the session).
// `hook.js codex` runs the same hook for Codex CLI, which needs its own outputs (see runHook).
// eslint-disable-next-line antfu/no-top-level-await
process.exit(mode === 'wait' ? await runWait() : (await runHook(mode === 'codex' ? 'codex' : 'claude-code'), 0))
