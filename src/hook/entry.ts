// 플러그인에 번들되는 hook 진입점 (plugin/bin/hook.js). 플러그인은 캐시로 복사되므로 자체 완결이어야 한다.
import process from 'node:process'
import { runHook } from './index'
import { runWait } from './wait'

// Bundle entry point: top-level await waits for the hook to finish before exiting.
// `hook.js wait` is the wake-up Stop hook, the one mode that may exit non-zero (2 wakes the session).
// eslint-disable-next-line antfu/no-top-level-await
process.exit(process.argv[2] === 'wait' ? await runWait() : (await runHook(), 0))
