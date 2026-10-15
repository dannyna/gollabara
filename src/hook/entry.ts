// 플러그인에 번들되는 hook 진입점 (plugin/bin/hook.js). 플러그인은 캐시로 복사되므로 자체 완결이어야 한다.
import process from 'node:process'
import { HARD_DEADLINE_MS, runHook } from './core'
import { runWait } from './wait'

const mode = process.argv[2]
if (mode !== 'wait')
  setTimeout(() => process.exit(0), HARD_DEADLINE_MS).unref()

// Bundle entry point: top-level await waits for the hook to finish before exiting.
// `hook.js wait` is the wake-up Stop hook, the one mode that may exit non-zero (2 wakes the session).
// `hook.js codex` runs the same hook for Codex CLI, which needs its own outputs (see runHook).
// eslint-disable-next-line antfu/no-top-level-await
process.exit(mode === 'wait' ? await runWait() : (await runHook(mode === 'codex' ? 'codex' : 'claude-code'), 0))
