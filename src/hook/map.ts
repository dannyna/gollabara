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
  transcript_path?: string
}

/**
 * Who opened the current turn: a person (typed, or sent through the SDK), something the
 * session itself scheduled (task notification, Monitor event, peer message, ...), or unknown
 * when the transcript gave no answer.
 */
export type TurnOpener = 'human' | 'system' | 'unknown'

/** `turnOrigin` values seen on real transcripts. A value not listed here counts as unknown, so the recap still posts */
const HUMAN_TURN_ORIGINS = new Set(['human', 'sdk'])
const WAKE_UP_TURN_ORIGINS = new Set(['task_notification', 'peer', 'system', 'scheduled'])

/** Hook process env. Only the keys read here; never pass the rest along (it holds tool tokens). */
export interface HookEnv {
  OD_PROJECT_ID?: string
}

/** Start of every feedback line, also how a delivery is recognised in the transcript */
const FEEDBACK_PREFIX = '[gollabara] Feedback from the user'

export function sessionName(cwd: string, branch?: string): string {
  const dir = cwd.split('/').filter(Boolean).pop() ?? cwd
  return branch && branch !== 'main' && branch !== 'master' ? `${dir} · ${branch}` : dir
}

/** Filesystem lookups the session name needs. hook/index.ts supplies the real ones. */
export interface GitLookup {
  /** Nearest ancestor of cwd (or cwd itself) holding `.git`, or cwd when there is none */
  projectRoot: (cwd: string) => string
  readBranch: (root: string) => string | undefined
}

/**
 * Builds the session from hook input and env. Open Design runs set OD_PROJECT_ID;
 * those sessions are named after the project and skip the git lookup.
 * Others are named after the project root, not cwd, so a `cd` mid-session keeps the name.
 */
export function sessionInfo(input: HookInput, env: HookEnv, git: GitLookup): SessionInfo {
  const project = env.OD_PROJECT_ID
  if (project)
    return { id: input.session_id, name: project, harness: 'open-design', project, cwd: input.cwd }
  const root = git.projectRoot(input.cwd)
  return { id: input.session_id, name: sessionName(root, git.readBranch(root)), harness: 'claude-code', cwd: input.cwd }
}

/**
 * Classifies the turn from the tail of a Claude Code transcript (JSONL). Only the entry that
 * opens a turn carries `turnOrigin`, so the last one in the tail is the current turn's.
 * Feedback gollabara delivered after that opener makes the turn the user's: they wait on the reply.
 * The first line of a tail is usually cut off and is skipped like any unparsable line.
 */
export function turnOpener(tail: string): TurnOpener {
  const lines = tail.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    // Cheap filter first: screenshot turns carry multi-MB base64 lines
    const opens = line.includes('"turnOrigin"')
    if (!opens && !line.includes(FEEDBACK_PREFIX))
      continue
    let entry: any
    try {
      entry = JSON.parse(line)
    }
    catch {
      continue
    }
    if (entry?.isSidechain)
      continue
    if (isFeedbackDelivery(entry))
      return 'human'
    if (!opens || entry?.type !== 'user' || typeof entry.turnOrigin !== 'string')
      continue
    return HUMAN_TURN_ORIGINS.has(entry.turnOrigin) ? 'human' : WAKE_UP_TURN_ORIGINS.has(entry.turnOrigin) ? 'system' : 'unknown'
  }
  return 'unknown'
}

/** Hook context that handed gollabara feedback to the session (PostToolUse, Stop or UserPromptSubmit) */
function isFeedbackDelivery(entry: any): boolean {
  const attachment = entry?.type === 'attachment' ? entry.attachment : undefined
  return attachment?.type === 'hook_additional_context'
    && Array.isArray(attachment.content)
    && attachment.content.some((c: unknown) => typeof c === 'string' && c.startsWith(FEEDBACK_PREFIX))
}

export function mapHook(input: HookInput, session: SessionInfo, opener: TurnOpener = 'unknown'): IncomingEvent | null {
  switch (input.hook_event_name) {
    case 'SessionStart':
      return { kind: 'session', session }
    case 'PostToolUse': {
      const images = extractImages(input.tool_response)
      if (images.length === 0)
        return null
      // One path names one image; a multi-page read shares a path across different pages
      const source = images.length === 1 ? imageSource(input.tool_input) : undefined
      if (source)
        images[0]!.source = source
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
      // A wake-up the user did not start (Monitor tick, task notification) is not worth a line.
      // A continuation follows a stop hook such as gollabara feedback, so it keeps its recap
      if (opener === 'system' && !input.stop_hook_active)
        return null
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
  // On Stop this keeps the turn going without the error notice `decision: block` shows;
  // the claim already emptied the queue, so the re-entered Stop lets it end
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
  return `${FEEDBACK_PREFIX} while you work (sent ${clock(item.createdAt)}${about}): ${item.text}`
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
  // The whole first line, never cut: a recap that ends in … loses its point
  return line || null
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

/**
 * The file a tool says the image came from. Read takes `file_path`; screenshot tools
 * (e.g. Playwright MCP's `filename`) and other MCP tools name it with `path` or `filename`.
 */
export function imageSource(toolInput: any): string | undefined {
  for (const key of ['file_path', 'path', 'filename']) {
    const value = toolInput?.[key]
    if (typeof value === 'string' && value.trim())
      return value.trim()
  }
  return undefined
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
