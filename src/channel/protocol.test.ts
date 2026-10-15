import type { Feedback } from '../shared/types'
import { describe, expect, test } from 'bun:test'
import { feedbackOutput } from '../hook/map'
import { channelEnabled, feedbackNotification, PROTOCOL_VERSIONS, respond } from './protocol'

const initialize = (protocolVersion: string) => ({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion, capabilities: {} } })

describe('handshake (as Claude Code 2.1.296 sends it)', () => {
  test('declares the channel capability and no tools', () => {
    const reply = respond(initialize('2025-11-25')) as any
    expect(reply.result.protocolVersion).toBe('2025-11-25')
    expect(reply.result.capabilities).toEqual({ experimental: { 'claude/channel': {} } })
    expect(reply.result.instructions).toContain('[gollabara] Feedback from the user')
  })

  test('never agrees to 2026-07-28, which cannot carry channel messages', () => {
    expect((respond(initialize('2026-07-28')) as any).result.protocolVersion).toBe(PROTOCOL_VERSIONS[0])
    expect(respond({ jsonrpc: '2.0', id: 'server-discover-probe-1', method: 'server/discover', params: {} }))
      .toMatchObject({ id: 'server-discover-probe-1', error: { code: -32601 } })
  })

  test('answers ping, refuses tool calls, and stays quiet on notifications', () => {
    expect(respond({ jsonrpc: '2.0', id: 3, method: 'ping' })).toEqual({ jsonrpc: '2.0', id: 3, result: {} })
    expect(respond({ jsonrpc: '2.0', id: 4, method: 'tools/list' })).toMatchObject({ error: { code: -32601 } })
    expect(respond({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull()
    expect(respond('not an object')).toBeNull()
  })
})

describe('feedback notification', () => {
  test('carries the same text the hook adds as context', () => {
    const items: Feedback[] = [
      { id: 1, sessionId: 's1', text: 'Make the header darker', createdAt: new Date(2026, 9, 14, 23, 16).getTime() },
      { id: 2, sessionId: 's1', text: 'This card is cut off', image: { url: '/img/a.png', path: '/data/images/a.png', at: 0 }, createdAt: 0 },
    ]
    const hook = feedbackOutput('PostToolUse', items) as { hookSpecificOutput: { additionalContext: string } }
    expect(feedbackNotification(items)).toEqual({
      jsonrpc: '2.0',
      method: 'notifications/claude/channel',
      params: { content: hook.hookSpecificOutput.additionalContext, meta: { from: 'gollabara' } },
    })
  })
})

describe('channelEnabled (the parent claude command line)', () => {
  test('on only when this plugin is named as a channel', () => {
    expect(channelEnabled('claude --dangerously-load-development-channels plugin:gollabara@gollabara')).toBe(true)
    expect(channelEnabled('claude --plugin-dir /x/plugin --dangerously-load-development-channels plugin:gollabara@inline')).toBe(true)
    expect(channelEnabled('claude --channels plugin:telegram@claude-plugins-official plugin:gollabara@gollabara --model x')).toBe(true)
    expect(channelEnabled('claude --channels=plugin:gollabara@gollabara')).toBe(true)
  })

  test('off for a plain session, another channel, or -p (which ignores the flags)', () => {
    expect(channelEnabled('claude')).toBe(false)
    expect(channelEnabled('claude --channels plugin:telegram@claude-plugins-official')).toBe(false)
    expect(channelEnabled('claude plugin:gollabara@gollabara')).toBe(false)
    expect(channelEnabled('claude -p --dangerously-load-development-channels plugin:gollabara@gollabara hi')).toBe(false)
    expect(channelEnabled('')).toBe(false)
  })
})
