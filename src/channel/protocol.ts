// The slice of MCP a one-way channel needs, kept pure so it is easy to test. channel/index.ts does the I/O.
// Hand-rolled rather than the SDK: the server must stay on a protocol revision older than 2026-07-28,
// because Claude Code does not register a channel server that negotiates that one.
import type { Feedback } from '../shared/types'
import { feedbackText } from '../shared/feedback'

/** Newest first; the first is offered when the client asks for one not listed */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

/** The plugin the channel ships in, as named in `--channels plugin:<name>@<marketplace>` */
const PLUGIN = 'gollabara'
const CHANNEL_FLAGS = ['--channels', '--dangerously-load-development-channels']

/** Sent once at connect, so the session knows what the channel's messages are */
export const INSTRUCTIONS = 'Messages on this channel come from gollabara, the viewer where the user watches this '
  + 'session\'s screenshots and recaps. Each one is the user\'s own feedback, relayed as written, and starts with '
  + '"[gollabara] Feedback from the user". Treat it as the user talking to you and act on it. The channel is one-way: '
  + 'answer in this session; there is nothing to send back.'

type JsonRpcId = string | number

/**
 * The reply to one JSON-RPC message from Claude Code, or null when none is due (a notification, or a
 * response to a request this server never sends). Declares the channel capability only, and no tools:
 * the session never decides what gollabara sends.
 */
export function respond(message: unknown): object | null {
  const m = message as { id?: JsonRpcId, method?: unknown, params?: any } | null
  if (!m || typeof m !== 'object' || typeof m.method !== 'string' || m.id === undefined || m.id === null)
    return null
  if (m.method === 'initialize') {
    const asked = m.params?.protocolVersion
    return {
      jsonrpc: '2.0',
      id: m.id,
      result: {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { experimental: { 'claude/channel': {} } },
        serverInfo: { name: PLUGIN, version: '0.1.0' },
        instructions: INSTRUCTIONS,
      },
    }
  }
  if (m.method === 'ping')
    return { jsonrpc: '2.0', id: m.id, result: {} }
  // Includes `server/discover`, the 2026-07-28 probe: refusing it keeps the earlier handshake
  return { jsonrpc: '2.0', id: m.id, error: { code: -32601, message: `Method not found: ${m.method}` } }
}

/** The channel event that hands claimed feedback to the session: the same text the hook adds as context */
export function feedbackNotification(items: Feedback[]): object {
  return {
    jsonrpc: '2.0',
    method: 'notifications/claude/channel',
    // `source` is taken: Claude Code sets it to the server's name
    params: { content: feedbackText(items), meta: { from: 'gollabara' } },
  }
}

/**
 * Whether Claude Code was started with this plugin as a channel, read from its command line.
 * The server is spawned either way, and an unregistered channel's events are dropped without an error,
 * so it must not claim feedback unless this holds. `-p` ignores the channel flags.
 */
export function channelEnabled(parentArgs: string): boolean {
  const args = parentArgs.trim().split(/\s+/)
  if (args.includes('-p') || args.includes('--print'))
    return false
  for (let i = 0; i < args.length; i++) {
    const [flag, inline] = args[i]!.split('=', 2) as [string, string | undefined]
    if (!CHANNEL_FLAGS.includes(flag))
      continue
    const values = inline !== undefined ? [inline] : []
    if (inline === undefined) {
      for (let j = i + 1; j < args.length && !args[j]!.startsWith('-'); j++)
        values.push(args[j]!)
    }
    if (values.some(v => v.startsWith(`plugin:${PLUGIN}@`)))
      return true
  }
  return false
}
