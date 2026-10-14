import type { SessionInfo } from '../shared/types'
import type { HookInput } from './map'
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
import { extractImages, mapHook, recapOf, sessionInfo, sessionName } from './map'

const session: SessionInfo = { id: 's1', name: 'piuda', harness: 'claude-code', cwd: '/Users/me/IdeaProjects/piuda' }

function noBranchLookup() {
  throw new Error('Open Design sessions must not read the git branch')
}
const odSession = (input: HookInput) => sessionInfo(input, odEnv, noBranchLookup)

describe('Open Design (real payloads and env captured in the spike)', () => {
  test('SessionStart becomes an open-design session named after the project', () => {
    for (const source of ['startup', 'resume']) {
      const input = { ...odSessionStart, source } as HookInput
      expect(mapHook(input, odSession(input))).toEqual({
        kind: 'session',
        session: { id: odSessionStart.session_id, name: 'gollabara-spike', harness: 'open-design', project: 'gollabara-spike', cwd: odSessionStart.cwd },
      })
    }
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
    expect(sessionInfo(input, {}, () => 'feat/shell')).toEqual({
      id: input.session_id,
      name: sessionName(input.cwd, 'feat/shell'),
      harness: 'claude-code',
      cwd: input.cwd,
    })
    expect(sessionInfo(input, { OD_PROJECT_ID: '' }, () => undefined).harness).toBe('claude-code')
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

  test('does not stream an MCP text result without images', () => {
    expect(mapHook(postMcpText as HookInput, session)).toBeNull()
  })

  test('Stop uses the first line of the last reply as the recap', () => {
    const event = mapHook(stop as HookInput, session)
    expect(event).toEqual({ kind: 'recap', session, text: '`echo hi` 결과는 `hi`였습니다.'.replace(/`/g, '') })
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
  test('recap strips Markdown markers and truncates at 160 chars', () => {
    expect(recapOf('## 끝났습니다\n\n자세한 내용')).toBe('끝났습니다')
    expect(recapOf('가'.repeat(200))!.length).toBe(160)
    expect(recapOf('')).toBeNull()
  })

  test('sender name is folder and branch (except main)', () => {
    expect(sessionName('/a/piuda', 'main')).toBe('piuda')
    expect(sessionName('/a/piuda', 'feat/shell')).toBe('piuda · feat/shell')
  })
})
