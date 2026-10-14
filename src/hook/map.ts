// Claude Code hook 입력(stdin JSON)을 스트림 이벤트로 바꾼다.
// 순수 함수로 두어 테스트하기 쉽게 한다. I/O 는 hook/index.ts 가 맡는다.
import type { IncomingEvent, IncomingImage, Question, SessionInfo } from '../shared/types'

export interface HookInput {
  hook_event_name: string
  session_id: string
  cwd: string
  tool_name?: string
  tool_input?: any
  tool_response?: any
  last_assistant_message?: string
}

const RECAP_MAX = 160

export function sessionName(cwd: string, branch?: string): string {
  const dir = cwd.split('/').filter(Boolean).pop() ?? cwd
  return branch && branch !== 'main' && branch !== 'master' ? `${dir} · ${branch}` : dir
}

export function mapHook(input: HookInput, session: SessionInfo): IncomingEvent | null {
  switch (input.hook_event_name) {
    case 'SessionStart':
      return { kind: 'session', session }
    case 'PostToolUse': {
      const images = extractImages(input.tool_response)
      if (images.length === 0)
        return null
      return { kind: 'image', session, toolName: input.tool_name ?? '', images }
    }
    case 'PreToolUse': {
      // 세션이 원래 하던 질문만 비춘다. 질문을 새로 만들지 않는다.
      if (input.tool_name !== 'AskUserQuestion')
        return null
      const questions = extractQuestions(input.tool_input)
      return questions.length ? { kind: 'question', session, questions } : null
    }
    case 'Stop': {
      const text = recapOf(input.last_assistant_message)
      return text ? { kind: 'recap', session, text } : null
    }
    default:
      return null
  }
}

/** 턴 마지막 답변에서 한 줄 리캡을 뽑는다 */
export function recapOf(message?: string): string | null {
  if (!message)
    return null
  const line = message
    .split('\n')
    .map(l => l.replace(/^[#>*\-\s]+/, '').replace(/[*`]/g, '').trim())
    .find(l => l.length > 0)
  if (!line)
    return null
  return line.length > RECAP_MAX ? `${line.slice(0, RECAP_MAX - 1)}…` : line
}

/**
 * 도구 결과에서 이미지를 찾는다. 두 형태를 지원한다.
 * - 내장 Read: { type: 'image', file: { base64, type, dimensions } }
 * - MCP 콘텐츠 배열: [{ type: 'image', data, mimeType }]
 */
export function extractImages(response: unknown): IncomingImage[] {
  const out: IncomingImage[] = []
  const visit = (node: any, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 6)
      return
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1)
      return
    }
    if (node.type === 'image' && node.file?.base64) {
      const d = node.file.dimensions ?? {}
      out.push({
        data: node.file.base64,
        mime: node.file.type ?? 'image/png',
        width: d.originalWidth ?? d.displayWidth,
        height: d.originalHeight ?? d.displayHeight,
      })
      return
    }
    if (node.type === 'image' && typeof node.data === 'string') {
      out.push({ data: node.data, mime: node.mimeType ?? node.mime_type ?? 'image/png' })
      return
    }
    if (node.type === 'image' && node.source?.type === 'base64') {
      out.push({ data: node.source.data, mime: node.source.media_type ?? 'image/png' })
      return
    }
    for (const value of Object.values(node)) visit(value, depth + 1)
  }
  visit(response, 0)
  return out
}

function extractQuestions(toolInput: any): Question[] {
  const list = Array.isArray(toolInput?.questions) ? toolInput.questions : []
  return list
    .filter((q: any) => typeof q?.question === 'string')
    .map((q: any) => ({
      question: q.question,
      header: q.header,
      multiSelect: q.multiSelect,
      options: Array.isArray(q.options)
        ? q.options.map((o: any) => ({ label: String(o?.label ?? ''), description: o?.description }))
        : [],
    }))
}
