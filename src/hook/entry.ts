// 플러그인에 번들되는 hook 진입점 (plugin/bin/hook.js). 플러그인은 캐시로 복사되므로 자체 완결이어야 한다.
import process from 'node:process'
import { runHook } from './index'

// Bundle entry point: top-level await waits for the hook to finish before exiting.
// eslint-disable-next-line antfu/no-top-level-await
await runHook()
process.exit(0)
