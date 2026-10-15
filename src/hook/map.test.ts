import type { Feedback, SessionInfo } from '../shared/types'
import type { HookInput } from './map'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import odEnv from './fixtures/od-env.json'
import odPostReadImage from './fixtures/od-post-read-image.json'
import odPostWrite from './fixtures/od-post-write.json'
import odSessionStart from './fixtures/od-session-start.json'
import odStopHookActive from './fixtures/od-stop-hook-active.json'
import odStop from './fixtures/od-stop.json'
import postMcpText from './fixtures/post-mcp-text.json'
import postReadImage from './fixtures/post-read-image.json'
import stop from './fixtures/stop.json'
import { extractImages, feedbackOutput, feedbackVia, imageRole, mapHook, readFilePath, recapOf, sessionInfo, sessionName, sessionStartedAt, turnOpener, turnStartedAt } from './map'

const session: SessionInfo = { id: 's1', name: 'piuda', harness: 'claude-code', cwd: '/Users/me/IdeaProjects/piuda' }

const noBranchLookup = {
  projectRoot(): string {
    throw new Error('Open Design sessions must not look up the git root')
  },
  readBranch(): string | undefined {
    throw new Error('Open Design sessions must not read the git branch')
  },
}
const odSession = (input: HookInput) => sessionInfo(input, odEnv, noBranchLookup)

describe('Open Design (real payloads and env captured in the spike)', () => {
  test('SessionStart becomes an open-design session named after the project', () => {
    for (const source of ['startup', 'resume'] as const) {
      const input = { ...odSessionStart, source } as HookInput
      expect(mapHook(input, odSession(input))).toEqual({
        kind: 'session',
        session: { id: odSessionStart.session_id, name: 'gollabara-spike', harness: 'open-design', project: 'gollabara-spike', cwd: odSessionStart.cwd },
        reason: source,
      })
    }
  })

  test('SessionStart carries why the session started, and drops a source it does not know', () => {
    for (const source of ['clear', 'compact']) {
      const input = { ...odSessionStart, source } as HookInput
      expect(mapHook(input, odSession(input))).toMatchObject({ kind: 'session', reason: source })
    }
    const input = { ...odSessionStart, source: 'teleport' } as HookInput
    expect(mapHook(input, odSession(input))).not.toHaveProperty('reason')
  })

  test('Read image lands under the Open Design session', () => {
    const event = mapHook(odPostReadImage as HookInput, odSession(odPostReadImage as HookInput))
    expect(event).toMatchObject({ kind: 'image', toolName: 'Read', session: { harness: 'open-design', project: 'gollabara-spike' } })
    if (event?.kind === 'image')
      expect(event.images[0]).toMatchObject({ mime: 'image/png', width: 800, height: 500 })
  })

  test('Write without an image sends nothing', () => {
    expect(mapHook(odPostWrite as HookInput, odSession(odPostWrite as HookInput))).toBeNull()
  })

  test('both Stops in a turn become recaps; the stop-hook one is a continuation', () => {
    const first = mapHook(odStop as HookInput, odSession(odStop as HookInput))
    const second = mapHook(odStopHookActive as HookInput, odSession(odStopHookActive as HookInput))
    expect(first).toMatchObject({ kind: 'recap', text: expect.stringMatching(/^index\.html을 만들고/) })
    expect(first).not.toHaveProperty('continuation')
    expect(second).toMatchObject({ kind: 'recap', continuation: true, text: expect.stringMatching(/^디자인 훅이 지적한/) })
  })

  test('no other OD_* value reaches the event', () => {
    const env = { ...odEnv, OD_TOOL_TOKEN: 'secret-token' }
    const event = mapHook(odSessionStart as HookInput, sessionInfo(odSessionStart as HookInput, env, noBranchLookup))
    expect(JSON.stringify(event)).not.toContain('secret-token')
    expect(JSON.stringify(event)).not.toContain('OD_PROJECT_DIR')
    expect(Object.keys(event!.session).sort()).toEqual(['cwd', 'harness', 'id', 'name', 'project'])
  })
})

describe('sessionInfo', () => {
  test('without OD_PROJECT_ID it is a claude-code session named by folder and branch', () => {
    const input = postReadImage as HookInput
    expect(sessionInfo(input, {}, { projectRoot: cwd => cwd, readBranch: () => 'feat/shell' })).toEqual({
      id: input.session_id,
      name: sessionName(input.cwd, 'feat/shell'),
      harness: 'claude-code',
      cwd: input.cwd,
    })
    expect(sessionInfo(input, { OD_PROJECT_ID: '' }, { projectRoot: cwd => cwd, readBranch: () => undefined }).harness).toBe('claude-code')
  })

  test('a nested cwd is named after the project root and reads the branch there', () => {
    const input = { ...(postReadImage as HookInput), cwd: '/Users/me/piuda/apps/e2e-desktop' }
    const git = {
      projectRoot: () => '/Users/me/piuda',
      readBranch: (root: string) => root === '/Users/me/piuda' ? 'feat/e2e' : undefined,
    }
    expect(sessionInfo(input, {}, git)).toMatchObject({ name: 'piuda · feat/e2e', cwd: input.cwd })
  })
})

describe('mapHook (real payloads captured in the spike)', () => {
  test('captures a Read tool image result with its size', () => {
    const event = mapHook(postReadImage as HookInput, session)
    expect(event?.kind).toBe('image')
    if (event?.kind !== 'image')
      return
    expect(event.images).toHaveLength(1)
    expect(event.images[0]).toMatchObject({ mime: 'image/png', width: 1024, height: 1024 })
  })

  test('records the file a Read image came from as its source', () => {
    const event = mapHook(postReadImage as HookInput, session)
    if (event?.kind !== 'image')
      throw new Error('expected an image event')
    expect(event.images[0]!.source).toBe(postReadImage.tool_input.file_path)
  })

  test('leaves source unset when one path yields several images, or names none', () => {
    const base = { session_id: 's1', cwd: '/x', hook_event_name: 'PostToolUse', tool_name: 'Read' }
    const two = [{ type: 'image', data: 'AAAA', mimeType: 'image/png' }, { type: 'image', data: 'BBBB', mimeType: 'image/png' }]
    const pages = mapHook({ ...base, tool_input: { file_path: '/tmp/deck.pdf' }, tool_response: two }, session)
    const unnamed = mapHook({ ...base, tool_name: 'mcp__x__shot', tool_input: {}, tool_response: two.slice(0, 1) }, session)
    if (pages?.kind !== 'image' || unnamed?.kind !== 'image')
      throw new Error('expected image events')
    expect(pages.images.every(i => i.source === undefined)).toBe(true)
    expect(unnamed.images[0]!.source).toBeUndefined()
  })

  test('takes a screenshot tool\'s filename as the source', () => {
    const event = mapHook({
      session_id: 's1',
      cwd: '/x',
      hook_event_name: 'PostToolUse',
      tool_name: 'mcp__playwright__browser_take_screenshot',
      tool_input: { filename: 'login.png' },
      tool_response: [{ type: 'image', data: 'AAAA', mimeType: 'image/png' }],
    }, session)
    expect(event).toMatchObject({ images: [{ source: 'login.png' }] })
  })

  test('does not stream an MCP text result without images', () => {
    expect(mapHook(postMcpText as HookInput, session)).toBeNull()
  })

  test('Stop uses the first line of the last reply as the recap', () => {
    const event = mapHook(stop as HookInput, session)
    expect(event).toEqual({ kind: 'recap', session, text: '`echo hi` 결과는 `hi`였습니다.'.replace(/`/g, '') })
  })
})

describe('turn opener (real transcript tails, redacted)', () => {
  const tail = (name: string) => readFileSync(join(import.meta.dir, 'fixtures', name), 'utf8')

  test('a turn the user typed posts its recap, even right after a Monitor-opened turn', () => {
    const opener = turnOpener(tail('transcript-human.jsonl'))
    expect(opener).toBe('human')
    expect(mapHook(stop as HookInput, session, opener)).toMatchObject({ kind: 'recap' })
  })

  test('a turn sent through the SDK (the e2e runs) counts as the user\'s', () => {
    expect(turnOpener(tail('transcript-sdk.jsonl'))).toBe('human')
  })

  test('a background-task notification wake-up posts no recap', () => {
    const opener = turnOpener(tail('transcript-task-notification.jsonl'))
    expect(opener).toBe('system')
    expect(mapHook(stop as HookInput, session, opener)).toBeNull()
  })

  test('a Monitor event wake-up posts no recap', () => {
    const opener = turnOpener(tail('transcript-monitor.jsonl'))
    expect(opener).toBe('system')
    expect(mapHook(stop as HookInput, session, opener)).toBeNull()
  })

  test('a Monitor-opened turn that received gollabara feedback posts its recap', () => {
    const opener = turnOpener(tail('transcript-monitor-feedback.jsonl'))
    expect(opener).toBe('human')
    expect(mapHook(stop as HookInput, session, opener)).toMatchObject({ kind: 'recap' })
  })

  test('feedback delivered before the turn opened does not count', () => {
    const lines = tail('transcript-monitor-feedback.jsonl').split('\n')
    const feedback = lines.find(l => l.includes('hook_additional_context'))!
    const rest = lines.filter(l => l !== feedback)
    const opener = rest.findLastIndex(l => l.includes('"turnOrigin"'))
    expect(turnOpener([...rest.slice(0, opener), feedback, ...rest.slice(opener)].join('\n'))).toBe('system')
  })

  test('a turn gollabara\'s wake-up hook opened posts its recap as a new turn, though its Stop comes as a continuation', () => {
    const opener = turnOpener(tail('transcript-rewake.jsonl'))
    expect(opener).toBe('rewake')
    const recap = mapHook({ ...stop, stop_hook_active: true } as HookInput, session, opener)
    expect(recap).toMatchObject({ kind: 'recap' })
    expect(recap).not.toHaveProperty('continuation')
  })

  test('a wake-up turn that then got feedback at its Stop continues as usual', () => {
    // Claude Code records Stop's additionalContext the same way as PostToolUse's, under the Stop hook's name
    const feedback = tail('transcript-monitor-feedback.jsonl').split('\n').find(l => l.includes('hook_additional_context'))!.replace('"hookName":"PostToolUse:Bash"', '"hookName":"Stop"').replace('"hookEvent":"PostToolUse"', '"hookEvent":"Stop"')
    const opener = turnOpener(`${tail('transcript-rewake.jsonl')}\n${feedback}`)
    expect(opener).toBe('human')
    expect(mapHook({ ...stop, stop_hook_active: true } as HookInput, session, opener)).toMatchObject({ kind: 'recap', continuation: true })
  })

  test('another hook\'s wake-up stays a wake-up', () => {
    const other = tail('transcript-rewake.jsonl').replaceAll('[gollabara] Feedback from the user while you work (sent 12:18): ', '')
    expect(turnOpener(other)).toBe('system')
  })

  test('a continuation Stop keeps its recap whoever opened the turn', () => {
    expect(mapHook(odStopHookActive as HookInput, session, 'system')).toMatchObject({ kind: 'recap', continuation: true })
  })

  test('a tail without the opening entry or one that does not parse falls back to posting', () => {
    const lines = tail('transcript-monitor.jsonl').split('\n')
    const afterOpener = lines.slice(lines.findLastIndex(l => l.includes('"turnOrigin"')) + 1).join('\n')
    expect(turnOpener(afterOpener)).toBe('unknown')
    expect(turnOpener('not json\n{"type":"user"')).toBe('unknown')
    expect(mapHook(stop as HookInput, session, 'unknown')).toMatchObject({ kind: 'recap' })
  })

  test('an origin not seen before counts as unknown, so the recap still posts', () => {
    expect(turnOpener('{"type":"user","turnOrigin":"some_new_origin"}')).toBe('unknown')
  })
})

describe('image role', () => {
  const tail = (name: string) => readFileSync(join(import.meta.dir, 'fixtures', name), 'utf8')
  const openerAt = (text: string) => Date.parse(JSON.parse(text.split('\n').findLast(l => l.includes('"turnOrigin"'))!).timestamp)
  const shot = [{ type: 'image', data: 'AAAA', mimeType: 'image/png' }]
  const post = (tool_name: string, tool_input: object, tool_response: unknown = shot): HookInput =>
    ({ session_id: 's1', cwd: '/x', hook_event_name: 'PostToolUse', tool_name, tool_input, tool_response })
  const roles = (event: ReturnType<typeof mapHook>) => event?.kind === 'image' ? event.images.map(i => i.role) : null

  test('an image read from a file takes the role decided for that file', () => {
    const asked: string[] = []
    const event = mapHook(postReadImage as HookInput, session, 'unknown', (path) => {
      asked.push(path)
      return 'reference'
    })
    expect(asked).toEqual([postReadImage.tool_input.file_path])
    expect(roles(event)).toEqual(['reference'])
  })

  test('an image a tool produced directly is an artifact, without looking at any file', () => {
    const never = (): never => {
      throw new Error('no file to look at')
    }
    expect(roles(mapHook(post('mcp__od__render', {}), session, 'unknown', never))).toEqual(['artifact'])
    // An MCP tool that renders a file it did not change this turn still made the picture
    expect(roles(mapHook(post('mcp__od__render', { path: '/proj/index.html' }), session, 'unknown', never))).toEqual(['artifact'])
    // A relative screenshot name resolves against a cwd the hook can't know
    expect(roles(mapHook(post('mcp__playwright__browser_take_screenshot', { filename: 'login.png' }), session, 'unknown', never))).toEqual(['artifact'])
  })

  test('every page of a multi-page read shares the file\'s role', () => {
    const event = mapHook(post('Read', { file_path: '/tmp/deck.pdf' }, [...shot, ...shot]), session, 'unknown', () => 'reference')
    expect(roles(event)).toEqual(['reference', 'reference'])
  })

  test('without a role lookup every image is an artifact', () => {
    expect(roles(mapHook(postReadImage as HookInput, session))).toEqual(['artifact'])
  })

  test('only an absolute path names the file', () => {
    expect(readFilePath({ file_path: '/a/mock.png' })).toBe('/a/mock.png')
    expect(readFilePath({ path: '/a/mock.png' })).toBe('/a/mock.png')
    expect(readFilePath({ filename: 'shot.png' })).toBeUndefined()
    expect(readFilePath({})).toBeUndefined()
  })

  test('a file changed after the turn started is an artifact; one from before is a reference', () => {
    expect(imageRole(2000, 1000)).toBe('artifact')
    expect(imageRole(1000, 1000)).toBe('reference')
    expect(imageRole(500, 1000)).toBe('reference')
  })

  test('without either time the image is an artifact', () => {
    expect(imageRole(undefined, 1000)).toBe('artifact')
    expect(imageRole(500, undefined)).toBe('artifact')
  })

  test('the turn starts at its opener\'s timestamp', () => {
    expect(turnStartedAt(tail('transcript-human.jsonl'))).toBe(Date.parse('2026-10-13T14:54:48.567Z'))
    expect(turnStartedAt(tail('transcript-task-notification.jsonl'))).toBe(openerAt(tail('transcript-task-notification.jsonl')))
  })

  test('feedback delivered after the opener does not move the turn start', () => {
    const text = tail('transcript-monitor-feedback.jsonl')
    expect(turnOpener(text)).toBe('human')
    expect(turnStartedAt(text)).toBe(openerAt(text))
  })

  test('no opener in the tail, or a sidechain opener only, gives no turn start', () => {
    const lines = tail('transcript-monitor.jsonl').split('\n')
    expect(turnStartedAt(lines.slice(lines.findLastIndex(l => l.includes('"turnOrigin"')) + 1).join('\n'))).toBeUndefined()
    expect(turnStartedAt('{"type":"user","isSidechain":true,"turnOrigin":"human","timestamp":"2026-10-13T14:54:48.567Z"}')).toBeUndefined()
  })

  test('the session starts at the first timestamp in the transcript', () => {
    const head = '{"type":"summary"}\n{"type":"user","timestamp":"2026-10-13T10:00:00.000Z"}\n{"timestamp":"2026-10-13T11:00:00.000Z"}'
    expect(sessionStartedAt(head)).toBe(Date.parse('2026-10-13T10:00:00.000Z'))
    expect(sessionStartedAt('{"type":"summary"}\n{"cut off')).toBeUndefined()
  })
})

describe('extractImages', () => {
  test('captures image blocks in an MCP content array', () => {
    const images = extractImages([{ type: 'text', text: 'ok' }, { type: 'image', data: 'AAAA', mimeType: 'image/jpeg' }])
    expect(images).toEqual([{ data: 'AAAA', mime: 'image/jpeg' }])
  })
})

describe('question mirroring', () => {
  test('only AskUserQuestion becomes a question card', () => {
    const base = { session_id: 's1', cwd: '/x', hook_event_name: 'PreToolUse' }
    expect(mapHook({ ...base, tool_name: 'Bash', tool_input: {} }, session)).toBeNull()
    const event = mapHook({
      ...base,
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: '어느 시안으로 갈까요?', header: '시안', options: [{ label: 'A' }, { label: 'B', description: '추천' }] }] },
    }, session)
    expect(event).toMatchObject({ kind: 'question', questions: [{ question: '어느 시안으로 갈까요?', options: [{ label: 'A' }, { label: 'B' }] }] })
  })
})

describe('helpers', () => {
  test('recap strips Markdown markers and keeps the whole first line', () => {
    expect(recapOf('## 끝났습니다\n\n자세한 내용')).toBe('끝났습니다')
    expect(recapOf('가'.repeat(400))).toBe('가'.repeat(400))
    expect(recapOf('')).toBeNull()
  })

  test('sender name is folder and branch (except main)', () => {
    expect(sessionName('/a/piuda', 'main')).toBe('piuda')
    expect(sessionName('/a/piuda', 'feat/shell')).toBe('piuda · feat/shell')
  })
})

describe('feedback delivery', () => {
  const at = (h: number, m: number) => new Date(2026, 9, 14, h, m).getTime()
  const plain: Feedback = { id: 1, sessionId: 's1', text: 'Make the header darker', createdAt: at(23, 16) }
  const withImage: Feedback = {
    id: 2,
    sessionId: 's1',
    text: 'This card is cut off',
    image: { url: '/img/abc.png', path: '/Users/me/.gollabara/data/images/abc.png', at: at(23, 14), sessionName: 'piuda' },
    createdAt: at(23, 17),
  }

  test('only PostToolUse, Stop and UserPromptSubmit claim feedback', () => {
    expect(['PostToolUse', 'Stop', 'UserPromptSubmit', 'SessionStart', 'PreToolUse'].map(feedbackVia))
      .toEqual(['post-tool-use', 'stop', 'user-prompt-submit', null, null])
  })

  test('PostToolUse and UserPromptSubmit add context labelled as the user\'s feedback', () => {
    const line = '[gollabara] Feedback from the user while you work (sent 23:16): Make the header darker'
    for (const hookEventName of ['PostToolUse', 'UserPromptSubmit'])
      expect(feedbackOutput(hookEventName, [plain])).toEqual({ hookSpecificOutput: { hookEventName, additionalContext: line } })
  })

  test('Stop continues the turn with the feedback as additional context', () => {
    expect(feedbackOutput('Stop', [plain])).toEqual({ hookSpecificOutput: { hookEventName: 'Stop', additionalContext: expect.stringContaining('Make the header darker') } })
  })

  test('image feedback names the stored file, its capture time and session; items join line by line', () => {
    const out = feedbackOutput('PostToolUse', [plain, withImage]) as { hookSpecificOutput: { additionalContext: string } }
    expect(out.hookSpecificOutput.additionalContext.split('\n')).toEqual([
      '[gollabara] Feedback from the user while you work (sent 23:16): Make the header darker',
      '[gollabara] Feedback from the user while you work (sent 23:17, about the image /Users/me/.gollabara/data/images/abc.png captured 23:14 in piuda): This card is cut off',
    ])
  })

  test('nothing to print without items or on other hooks', () => {
    expect(feedbackOutput('Stop', [])).toBeNull()
    expect(feedbackOutput('SessionStart', [plain])).toBeNull()
  })
})
