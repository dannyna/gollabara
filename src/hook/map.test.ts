import type { SessionInfo } from '../shared/types'
import type { HookInput } from './map'
import { describe, expect, test } from 'bun:test'
import postMcpText from './fixtures/post-mcp-text.json'
import postReadImage from './fixtures/post-read-image.json'
import stop from './fixtures/stop.json'
import { extractImages, mapHook, recapOf, sessionName } from './map'

const session: SessionInfo = { id: 's1', name: 'piuda', cwd: '/Users/me/IdeaProjects/piuda' }

describe('mapHook (스파이크에서 잡은 실제 payload)', () => {
  test('Read 도구 이미지 결과를 크기와 함께 잡는다', () => {
    const event = mapHook(postReadImage as HookInput, session)
    expect(event?.kind).toBe('image')
    if (event?.kind !== 'image')
      return
    expect(event.images).toHaveLength(1)
    expect(event.images[0]).toMatchObject({ mime: 'image/png', width: 1024, height: 1024 })
  })

  test('이미지가 없는 MCP 텍스트 결과는 흘리지 않는다', () => {
    expect(mapHook(postMcpText as HookInput, session)).toBeNull()
  })

  test('Stop 은 마지막 답변의 첫 줄을 리캡으로 쓴다', () => {
    const event = mapHook(stop as HookInput, session)
    expect(event).toEqual({ kind: 'recap', session, text: '`echo hi` 결과는 `hi`였습니다.'.replace(/`/g, '') })
  })
})

describe('extractImages', () => {
  test('MCP 콘텐츠 배열의 image 블록을 잡는다', () => {
    const images = extractImages([{ type: 'text', text: 'ok' }, { type: 'image', data: 'AAAA', mimeType: 'image/jpeg' }])
    expect(images).toEqual([{ data: 'AAAA', mime: 'image/jpeg' }])
  })
})

describe('질문 미러링', () => {
  test('AskUserQuestion 만 질문 카드가 된다', () => {
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

describe('보조 함수', () => {
  test('리캡은 마크다운 기호를 걷어 내고 160자에서 자른다', () => {
    expect(recapOf('## 끝났습니다\n\n자세한 내용')).toBe('끝났습니다')
    expect(recapOf('가'.repeat(200))!.length).toBe(160)
    expect(recapOf('')).toBeNull()
  })

  test('발신자 이름은 폴더와 브랜치(main 제외)', () => {
    expect(sessionName('/a/piuda', 'main')).toBe('piuda')
    expect(sessionName('/a/piuda', 'feat/shell')).toBe('piuda · feat/shell')
  })
})
