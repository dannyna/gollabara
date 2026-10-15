// First-run guides for the gallery (#75): what the server would know in each state

import type { Guide } from '../../firstrun'

const minutesAgo = (n: number) => Date.now() - n * 60_000
const yesterday = () => new Date(Date.now() - 86_400_000).setHours(18, 40, 0, 0)

export const GUIDES = {
  /** No hook has ever posted */
  none: { harnesses: [], step: 'setup' },
  /** Plugins installed, no session today */
  connected: {
    harnesses: [
      { harness: 'claude-code', label: 'Claude Code', seenAt: yesterday(), outdated: false },
      { harness: 'codex', label: 'Codex', seenAt: yesterday() - 3_600_000, outdated: false },
    ],
    step: 'start',
  },
  /** A session is running and has made nothing yet */
  running: {
    harnesses: [{ harness: 'claude-code', label: 'Claude Code', seenAt: minutesAgo(2), outdated: false }],
    step: 'wait',
  },
  /** A hook older than the server */
  outdated: {
    harnesses: [
      { harness: 'claude-code', label: 'Claude Code', seenAt: minutesAgo(4), outdated: true, version: '0.2.1' },
      { harness: 'codex', label: 'Codex', seenAt: minutesAgo(30), outdated: false },
    ],
    step: 'update',
  },
  /** Scoped to a session that ended */
  ended: {
    harnesses: [{ harness: 'codex', label: 'Codex', seenAt: minutesAgo(50), outdated: false }],
    step: 'ended',
  },
} satisfies Record<string, Guide>
