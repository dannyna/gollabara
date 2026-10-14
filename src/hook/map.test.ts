import type { SessionInfo } from '../shared/types'
import type { HookInput } from './map'
import { describe, expect, test } from 'bun:test'
import postMcpText from './fixtures/post-mcp-text.json'
import postReadImage from './fixtures/post-read-image.json'
import stop from './fixtures/stop.json'
import { extractImages, mapHook, recapOf, sessionName } from './map'

const session: SessionInfo = { id: 's1', name: 'piuda', cwd: '/Users/me/IdeaProjects/piuda' }

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
