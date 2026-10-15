// Which delivery routes a session has. Shared by the server, which reports them with each session,
// and the UI, which says how feedback will reach it.
import type { DeliveryRoute, Harness } from './types'

/** Every harness with an adapter picks feedback up at the next tool call, the next prompt and the turn's end */
const HOOK_ROUTES: DeliveryRoute[] = ['next-tool', 'next-prompt', 'turn-end']

/**
 * The routes a session has now. Only Claude Code (Open Design runs included) can wake an idle session,
 * and only while its wake-up Stop hook is waiting (`waiterLive`). Codex hooks have no idle wake.
 */
export function routesFor(harness: Harness, waiterLive: boolean): DeliveryRoute[] {
  const wakes = waiterLive && (harness === 'claude-code' || harness === 'open-design')
  return wakes ? [...HOOK_ROUTES, 'idle-wake'] : [...HOOK_ROUTES]
}
