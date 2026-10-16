import type { Feedback } from '../shared/types'
import type { HookInput } from './map'
import { Buffer } from 'node:buffer'
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'bun:test'
import { codexTurnStartedAt } from './codex'
import { readFileRole } from './core'
import postBash from './fixtures/codex/post-bash.json'
import postMcpImage from './fixtures/codex/post-mcp-image.json'
import postRequestUserInput from './fixtures/codex/post-request-user-input.json'
import postViewImage from './fixtures/codex/post-view-image.json'
import preBash from './fixtures/codex/pre-bash.json'
import preRequestUserInput from './fixtures/codex/pre-request-user-input.json'
import sessionEnd from './fixtures/codex/session-end.json'
import sessionStartResume from './fixtures/codex/session-start-resume.json'
import sessionStart from './fixtures/codex/session-start.json'
import stopHookActive from './fixtures/codex/stop-hook-active.json'
import stop from './fixtures/codex/stop.json'
import userPromptSubmit from './fixtures/codex/user-prompt-submit.json'
import { dataUrlImage, feedbackOutput, feedbackVia, mapHook, sessionInfo, sniffImageMime } from './map'

const git = { projectRoot: (cwd: string) => cwd, readBranch: () => 'feat/hero' }
const codex = (input: object) => sessionInfo(input as HookInput, { OD_PROJECT_ID: 'od-project' }, git, 'codex')
const map = (input: object) => mapHook(input as HookInput, codex(input))
const PNG_8X8 = postMcpImage.tool_response.content[1]!.data as string

describe('Codex mapping (payloads recorded in the spike)', () => {
  test('sessions are codex, named like Claude Code, and never read the Open Design env', () => {
    expect(codex(sessionStart)).toEqual({ id: sessionStart.session_id, name: 'demo · feat/hero', harness: 'codex', cwd: sessionStart.cwd })
  })

  test('SessionStart keeps its source as the reason; SessionEnd posts a session end', () => {
    expect(map(sessionStart)).toMatchObject({ kind: 'session', reason: 'startup' })
    expect(map(sessionStartResume)).toMatchObject({ kind: 'session', reason: 'resume' })
    expect(map(sessionEnd)).toEqual({ kind: 'session-end', session: codex(sessionEnd) })
  })

  test('view_image becomes an image: the type sniffed from bytes, the path as source, a reference when the file is older than the turn', () => {
    const event = mapHook(postViewImage as HookInput, codex(postViewImage), 'unknown', () => 'reference')
    expect(event).toMatchObject({
      kind: 'image',
      toolName: 'view_image',
      images: [{ mime: 'image/png', source: '/Users/me/IdeaProjects/demo/pic.png', role: 'reference' }],
    })
    expect((event as { images: { data: string }[] }).images[0]!.data.startsWith('iVBORw0KGgo')).toBe(true)
  })

  test('an MCP image keeps its own type and is always an artifact', () => {
    expect(mapHook(postMcpImage as HookInput, codex(postMcpImage), 'unknown', () => 'reference')).toMatchObject({
      kind: 'image',
      toolName: 'mcp__spikeimg__snapshot',
      images: [{ mime: 'image/png', role: 'artifact' }],
    })
  })

  test('shell output and the answer to a question carry no image', () => {
    expect(map(postBash)).toBeNull()
    expect(map(postRequestUserInput)).toBeNull()
    expect(map(preBash)).toBeNull()
  })

  test('request_user_input is mirrored as the session\'s own question, without multiSelect', () => {
    const event = map(preRequestUserInput)
    expect(event).toEqual({
      kind: 'question',
      session: codex(preRequestUserInput),
      questions: [{
        question: 'Which color do you prefer, red or blue?',
        header: 'Color',
        multiSelect: undefined,
        options: [
          { label: 'Red', description: 'Choose red as your preferred color.' },
          { label: 'Blue', description: 'Choose blue as your preferred color.' },
        ],
      }],
      // Codex's call id rides along, though Codex questions stay read-only
      id: 'call_pP4i9lTucZERxaPxpLPkGdry',
    })
    expect(JSON.parse(JSON.stringify(event)).questions[0]).not.toHaveProperty('multiSelect')
  })

  test('every Stop posts its recap; one after a block continues the turn', () => {
    expect(map(stop)).toEqual({ kind: 'recap', session: codex(stop), text: 'OK' })
    expect(map(stopHookActive)).toEqual({ kind: 'recap', session: codex(stopHookActive), text: 'PINEAPPLE', continuation: true })
    expect(map(userPromptSubmit)).toBeNull()
  })
})

describe('Codex feedback', () => {
  const item: Feedback = { id: 1, sessionId: 's1', text: 'Make it blue', createdAt: new Date(2026, 9, 16, 9, 5).getTime() }
  const line = '[gollabara] Feedback from the user while you work (sent 09:05): Make it blue'

  test('claims at the next tool call, the next prompt and Stop, never at a Stop that is already continuing', () => {
    expect(feedbackVia('PostToolUse', postBash as HookInput, 'codex')).toBe('post-tool-use')
    expect(feedbackVia('UserPromptSubmit', userPromptSubmit as HookInput, 'codex')).toBe('user-prompt-submit')
    expect(feedbackVia('Stop', stop, 'codex')).toBe('stop')
    expect(feedbackVia('Stop', stopHookActive, 'codex')).toBeNull()
    expect(feedbackVia('SessionEnd', sessionEnd as HookInput, 'codex')).toBeNull()
    // Claude Code keeps claiming at a continuation: its claim empties the queue, so the turn ends
    expect(feedbackVia('Stop', stopHookActive)).toBe('stop')
  })

  test('additionalContext on PostToolUse and UserPromptSubmit; Stop blocks with the feedback as the reason', () => {
    for (const hookEventName of ['PostToolUse', 'UserPromptSubmit'])
      expect(feedbackOutput(hookEventName, [item], 'codex')).toEqual({ hookSpecificOutput: { hookEventName, additionalContext: line } })
    expect(feedbackOutput('Stop', [item], 'codex')).toEqual({ decision: 'block', reason: line })
    expect(feedbackOutput('Stop', [], 'codex')).toBeNull()
  })
})

describe('Codex images and turns', () => {
  test('data URLs keep an image type, sniff the rest, and skip what is not an image', () => {
    expect(dataUrlImage(`data:image/jpeg;base64,${PNG_8X8}`)).toEqual({ data: PNG_8X8, mime: 'image/jpeg' })
    expect(dataUrlImage(`data:application/octet-stream;base64,${PNG_8X8}`)?.mime).toBe('image/png')
    expect(dataUrlImage(`data:application/octet-stream;base64,${btoa('plain text, not an image')}`)).toBeNull()
    expect(dataUrlImage('https://example.com/a.png')).toBeNull()
    expect(dataUrlImage(`data:image/png,${PNG_8X8}`)).toBeNull()
  })

  test('sniffs PNG, JPEG, GIF and WebP from the first bytes', () => {
    const b64 = (bytes: number[] | string) => Buffer.from(typeof bytes === 'string' ? bytes : Uint8Array.from(bytes)).toString('base64')
    expect(sniffImageMime(PNG_8X8)).toBe('image/png')
    expect(sniffImageMime(b64([0xFF, 0xD8, 0xFF, 0xE0, 0, 0]))).toBe('image/jpeg')
    expect(sniffImageMime(b64('GIF89a......'))).toBe('image/gif')
    expect(sniffImageMime(b64('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffImageMime(b64('%PDF-1.7'))).toBeUndefined()
  })

  const rollout = [
    '{"timestamp":"2026-10-15T15:19:16.961Z","type":"session_meta","payload":{"id":"s"}}',
    '{"timestamp":"2026-10-15T15:19:16.962Z","type":"event_msg","payload":{"type":"task_started","turn_id":"t1"}}',
    '{"timestamp":"2026-10-15T15:19:22.281Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"t1"}}',
    '{"timestamp":"2026-10-15T15:20:00.500Z","type":"event_msg","payload":{"type":"task_started","turn_id":"t2"}}',
    '{"timestamp":"2026-10-15T15:20:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"mentions \\"task_started\\" in text"}]}}',
  ].join('\n')

  test('a rollout\'s turn starts at its last task_started event', () => {
    expect(codexTurnStartedAt(rollout)).toBe(Date.parse('2026-10-15T15:20:00.500Z'))
    expect(codexTurnStartedAt('{"type":"session_meta"}')).toBeUndefined()
  })

  const dir = mkdtempSync(join(tmpdir(), 'gollabara-codex-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  test('a file view_image read is an artifact when it changed after the turn started (#41)', () => {
    const transcript = join(dir, 'rollout.jsonl')
    writeFileSync(transcript, rollout)
    const pic = join(dir, 'pic.png')
    writeFileSync(pic, '')
    utimesSync(pic, new Date('2026-10-15T15:19:30Z'), new Date('2026-10-15T15:19:30Z'))
    expect(readFileRole(pic, transcript, [1024], 'codex')).toBe('reference')
    utimesSync(pic, new Date('2026-10-15T15:20:05Z'), new Date('2026-10-15T15:20:05Z'))
    expect(readFileRole(pic, transcript, [1024], 'codex')).toBe('artifact')
  })
})
