// The Codex CLI adapter (`hook.js codex`): what only Codex's hooks need on top of the shared core (map.ts, core.ts).
// Codex records no turn origin, and feedback at Stop goes out as `decision: block`.

import type { HarnessAdapter } from './map'

export const codex: HarnessAdapter = {
  // How Open Design launches Codex is unverified, so its env is not read
  project: () => undefined,
  // Its turns open with a prompt, so the opener stays unknown and every Stop posts its recap
  stopOpener: () => 'unknown',
  // A Stop that is already continuing never blocks again, since Codex has no loop cap of its own,
  // so claiming there would lose the items
  claims: (hookEventName, input) => !(hookEventName === 'Stop' && input?.stop_hook_active),
  // Codex fails a Stop hook that returns additionalContext; `block` continues the same turn with the
  // reason as the user's words, and the next Stop comes as `stop_hook_active`, which never claims
  output: (hookEventName, text) => hookEventName === 'Stop'
    ? { decision: 'block', reason: text }
    : { hookSpecificOutput: { hookEventName, additionalContext: text } },
}
