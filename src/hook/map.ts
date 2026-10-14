// Turns Claude Code hook input (stdin JSON) into stream events.
// Kept pure so it is easy to test. hook/index.ts handles I/O.
import type { Feedback, FeedbackVia, IncomingEvent, IncomingImage, Question, SessionInfo } from '../shared/types'

export interface HookInput {
  hook_event_name: string
  session_id: string
  cwd: string
  tool_name?: string
  tool_input?: any
  tool_response?: any
  last_assistant_message?: string
  stop_hook_active?: boolean
}

/** Hook process env. Only the keys read here; never pass the rest along (it holds tool tokens). */
export interface HookEnv {
  OD_PROJECT_ID?: string
}

const RECAP_MAX = 160

export function sessionName(cwd: string, branch?: string): string {
  const dir = cwd.split('/').filter(Boolean).pop() ?? cwd
  return branch && branch !== 'main' && branch !== 'master' ? `${dir} · ${branch}` : dir
}

/**
 * Builds the session from hook input and env. Open Design runs set OD_PROJECT_ID;
 * those sessions are named after the project and skip the branch lookup.
 */
export function sessionInfo(input: HookInput, env: HookEnv, readBranch: (cwd: string) => string | undefined): SessionInfo {
  const project = env.OD_PROJECT_ID
  if (project)
    return { id: input.session_id, name: project, harness: 'open-design', project, cwd: input.cwd }
  return { id: input.session_id, name: sessionName(input.cwd, readBranch(input.cwd)), harness: 'claude-code', cwd: input.cwd }
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
      // Mirror only the session's own questions. Never invent new ones.
      if (input.tool_name !== 'AskUserQuestion')
        return null
      const questions = extractQuestions(input.tool_input)
      return questions.length ? { kind: 'question', session, questions } : null
    }
    case 'Stop': {
      const text = recapOf(input.last_assistant_message)
      if (!text)
        return null
      // A second Stop after another stop hook let the turn continue; both recaps matter
      return input.stop_hook_active ? { kind: 'recap', session, text, continuation: true } : { kind: 'recap', session, text }
    }
    default:
      return null
  }
}

/** Hook points where a session can pick up the user's feedback */
const FEEDBACK_VIA: Record<string, FeedbackVia> = {
  PostToolUse: 'post-tool-use',
  Stop: 'stop',
  UserPromptSubmit: 'user-prompt-submit',
}

export function feedbackVia(hookEventName: string): FeedbackVia | null {
  return FEEDBACK_VIA[hookEventName] ?? null
}

/** Hook stdout JSON that hands claimed feedback to the session, or null when there is nothing to print */
export function feedbackOutput(hookEventName: string, items: Feedback[]): object | null {
  if (items.length === 0 || !feedbackVia(hookEventName))
    return null
  const text = items.map(feedbackLine).join('\n')
  // Stop needs `block` to keep the turn going; the claim already emptied the queue, so the re-entered Stop lets it end
  if (hookEventName === 'Stop')
    return { decision: 'block', reason: text }
  return { hookSpecificOutput: { hookEventName, additionalContext: text } }
}

/**
 * Labelled as the user's own words relayed by gollabara, stated as fact rather than as a system
 * instruction, so the session treats it as the user talking and not as untrusted tool output.
 */
export function feedbackLine(item: Feedback): string {
  const about = item.image
    ? `, about the image ${item.image.path} captured ${clock(item.image.at)}${item.image.sessionName ? ` in ${item.image.sessionName}` : ''}`
    : ''
  return `[gollabara] Feedback from the user while you work (sent ${clock(item.createdAt)}${about}): ${item.text}`
}

function clock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Extracts a one-line recap from the turn's last reply */
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
 * Finds images in a tool result. Two shapes are supported:
 * - built-in Read: { type: 'image', file: { base64, type, dimensions } }
 * - MCP content array: [{ type: 'image', data, mimeType }]
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
