// 플러그인에 번들되는 hook 진입점 (plugin/bin/hook.js). 플러그인은 캐시로 복사되므로 자체 완결이어야 한다.
import process from 'node:process'
import { exitAt, HARD_DEADLINE_MS, runHook, SESSION_END_DEADLINE_MS } from './core'
import { runWait } from './wait'

const mode = process.argv[2]
// `hook.js session-end` (Claude Code's SessionEnd) knows its event before stdin, so even a stalled stdin
// ends inside Claude Code's SessionEnd budget
if (mode !== 'wait')
  exitAt(mode === 'session-end' ? SESSION_END_DEADLINE_MS : HARD_DEADLINE_MS)

// Bundle entry point: top-level await waits for the hook to finish before exiting.
// `hook.js wait` is the wake-up Stop hook, the one mode that may exit non-zero (2 wakes the session).
// `hook.js codex` runs the same hook for Codex CLI, which needs its own outputs (see runHook).
// eslint-disable-next-line antfu/no-top-level-await
process.exit(mode === 'wait' ? await runWait() : (await runHook(mode === 'codex' ? 'codex' : 'claude-code'), 0))
