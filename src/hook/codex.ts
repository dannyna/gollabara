// The Codex CLI adapter (`hook.js codex`): what only Codex's hooks need on top of the shared core (map.ts, core.ts).
// Codex records no turn origin, its turns start in the rollout, and feedback at Stop goes out as `decision: block`.

import type { HarnessAdapter } from './map'

/**
 * When the current turn started in a Codex rollout: the timestamp of the last `task_started` event.
 * A Stop `block` continues the same turn, so it opens none. Undefined when the tail holds none.
 */
export function codexTurnStartedAt(tail: string): number | undefined {
  const lines = tail.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    // Cheap filter first: image reads put multi-MB base64 lines in the rollout too
    if (!line.includes('"task_started"'))
      continue
    let entry: any
    try {
      entry = JSON.parse(line)
    }
    catch {
      continue
    }
    if (entry?.type !== 'event_msg' || entry.payload?.type !== 'task_started')
      continue
    const at = Date.parse(entry.timestamp)
    return Number.isFinite(at) ? at : undefined
  }
  return undefined
}

export const codex: HarnessAdapter = {
  // How Open Design launches Codex is unverified, so its env is not read
  project: () => undefined,
  // Its turns open with a prompt, so the opener stays unknown and every Stop posts its recap
  stopOpener: () => 'unknown',
  turnStartedAt: codexTurnStartedAt,
  // A Stop that is already continuing never blocks again, since Codex has no loop cap of its own,
  // so claiming there would lose the items
  claims: (hookEventName, input) => !(hookEventName === 'Stop' && input?.stop_hook_active),
  // Codex fails a Stop hook that returns additionalContext; `block` continues the same turn with the
  // reason as the user's words, and the next Stop comes as `stop_hook_active`, which never claims
  output: (hookEventName, text) => hookEventName === 'Stop'
    ? { decision: 'block', reason: text }
    : { hookSpecificOutput: { hookEventName, additionalContext: text } },
}
