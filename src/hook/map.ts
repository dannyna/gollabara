// The shared hook core's mapping: turns Claude Code and Codex CLI hook input (stdin JSON) into stream events,
// with the recap rules, image roles and feedback claims every harness shares. What differs per harness lives
// in its adapter (claude-code.ts, codex.ts). Kept pure so it is easy to test. hook/core.ts handles I/O.
import type { Feedback, FeedbackVia, ImageRole, IncomingEvent, IncomingImage, Question, SessionInfo, SessionStartReason } from '../shared/types'
import { Buffer } from 'node:buffer'
import { isAbsolute } from 'node:path'
import { feedbackText } from '../shared/feedback'
import { claudeCode } from './claude-code'
import { codex } from './codex'

export interface HookInput {
  hook_event_name: string
  session_id: string
  cwd: string
  tool_name?: string
  tool_input?: any
  tool_response?: any
  /** The tool call's id (Claude Code and Codex): names a question so its answer and a hold can find it */
  tool_use_id?: string
  last_assistant_message?: string
  stop_hook_active?: boolean
  transcript_path?: string
  /** SessionStart only: startup, resume, clear or compact (Codex sends startup or resume) */
  source?: string
}

/**
 * The harness whose hook ran, named by the hook command's argument (`hook.js codex`), never guessed from
 * env: Codex hooks inherit whatever env codex was started with, `CLAUDECODE` included.
 */
export type Adapter = 'claude-code' | 'codex'

/** What one harness's hooks do differently; everything else is the shared core */
export interface HarnessAdapter {
  /** The Open Design project the session runs under, read from the hook env */
  project: (env: HookEnv) => string | undefined
  /** Who opened the turn that just stopped; 'unknown' posts the recap */
  stopOpener: (transcriptPath?: string) => TurnOpener
  /** Whether this hook may claim feedback, at a hook point where claiming is possible at all */
  claims: (hookEventName: string, input?: Pick<HookInput, 'stop_hook_active'>) => boolean
  /** The hook stdout JSON that hands the feedback text to the session */
  output: (hookEventName: string, text: string) => object
}

export const ADAPTERS: Record<Adapter, HarnessAdapter> = { 'claude-code': claudeCode, codex }

/** Tools that put the session's own question on screen: Claude Code's, and Codex's (Plan mode only) */
const QUESTION_TOOLS = new Set(['AskUserQuestion', 'request_user_input'])

/**
 * Who opened the current turn: a person (typed, or sent through the SDK), gollabara's wake-up hook
 * carrying the user's feedback, something the session itself scheduled (task notification, Monitor
 * event, peer message, ...), or unknown when the transcript gave no answer.
 */
export type TurnOpener = 'human' | 'rewake' | 'system' | 'unknown'

const SESSION_START_REASONS: SessionStartReason[] = ['startup', 'resume', 'clear', 'compact']

/** Hook process env. Only the keys read here; never pass the rest along (it holds tool tokens). */
export interface HookEnv {
  OD_PROJECT_ID?: string
}

export function sessionName(cwd: string, branch?: string): string {
  const dir = cwd.split('/').filter(Boolean).pop() ?? cwd
  return branch && branch !== 'main' && branch !== 'master' ? `${dir} · ${branch}` : dir
}

/** Filesystem lookups the session name needs. hook/core.ts supplies the real ones. */
export interface GitLookup {
  /** Nearest ancestor of cwd (or cwd itself) holding `.git`, or cwd when there is none */
  projectRoot: (cwd: string) => string
  readBranch: (root: string) => string | undefined
}

/**
 * Builds the session from hook input and env. Open Design runs set OD_PROJECT_ID;
 * those sessions are named after the project and skip the git lookup.
 * Others are named after the project root, not cwd, so a `cd` mid-session keeps the name.
 * A Codex session is always `codex`: how Open Design launches Codex is unverified, so its env is not read.
 */
export function sessionInfo(input: HookInput, env: HookEnv, git: GitLookup, adapter: Adapter = 'claude-code'): SessionInfo {
  const project = ADAPTERS[adapter].project(env)
  if (project)
    return { id: input.session_id, name: project, harness: 'open-design', project, cwd: input.cwd }
  const root = git.projectRoot(input.cwd)
  return { id: input.session_id, name: sessionName(root, git.readBranch(root)), harness: adapter, cwd: input.cwd }
}

/** When the session started: the first timestamp at the head of its transcript (Claude Code) or rollout (Codex) */
export function sessionStartedAt(head: string): number | undefined {
  for (const line of head.split('\n')) {
    let entry: any
    try {
      entry = JSON.parse(line)
    }
    catch {
      continue
    }
    const at = typeof entry?.timestamp === 'string' ? Date.parse(entry.timestamp) : Number.NaN
    if (Number.isFinite(at))
      return at
  }
  return undefined
}

/**
 * A file the session read is an artifact when it changed after the session started (the session
 * made it), and a reference otherwise (a mock, an existing asset, an older screenshot). When
 * either time is unknown the image counts as an artifact, as every image did before roles.
 */
export function imageRole(mtimeMs: number | undefined, startedAt: number | undefined): ImageRole {
  if (mtimeMs === undefined || startedAt === undefined)
    return 'artifact'
  return mtimeMs > startedAt ? 'artifact' : 'reference'
}

/**
 * The file a tool read its images from, when it names one by absolute path. A relative name
 * (a screenshot tool's `filename`) resolves against a cwd the hook can't know, so it names none.
 */
export function readFilePath(toolInput: any): string | undefined {
  const path = imageSource(toolInput)
  return path && isAbsolute(path) ? path : undefined
}

/**
 * `fileRole` decides the role of images read from a file (hook/core.ts stats it). Images a tool
 * produced directly, a screenshot or an MCP result with no file behind it, are artifacts.
 */
export function mapHook(input: HookInput, session: SessionInfo, opener: TurnOpener = 'unknown', fileRole?: (path: string) => ImageRole): IncomingEvent | null {
  switch (input.hook_event_name) {
    case 'SessionStart': {
      const reason = SESSION_START_REASONS.find(r => r === input.source)
      return reason ? { kind: 'session', session, reason } : { kind: 'session', session }
    }
    case 'PostToolUse': {
      if (input.tool_name === 'AskUserQuestion')
        return answerEvent(input, session)
      const images = extractImages(input.tool_response)
      if (images.length === 0)
        return null
      // One path names one image; a multi-page read shares a path across different pages
      const source = images.length === 1 ? imageSource(input.tool_input) : undefined
      if (source)
        images[0]!.source = source
      // Every page of a multi-page read comes from the same file, so they share its role.
      // An MCP result is the tool's own output, even when its input names a file it rendered
      const path = input.tool_name?.startsWith('mcp__') ? undefined : readFilePath(input.tool_input)
      const role = path && fileRole ? fileRole(path) : 'artifact'
      for (const image of images)
        image.role = role
      return { kind: 'image', session, toolName: input.tool_name ?? '', images }
    }
    case 'PreToolUse': {
      // Mirror only the session's own questions. Never invent new ones.
      if (!QUESTION_TOOLS.has(input.tool_name ?? ''))
        return null
      const questions = extractQuestions(input.tool_input)
      if (!questions.length)
        return null
      return typeof input.tool_use_id === 'string' && input.tool_use_id ? { kind: 'question', session, questions, id: input.tool_use_id } : { kind: 'question', session, questions }
    }
    case 'Stop': {
      // A wake-up the user did not start (Monitor tick, task notification) is not worth a line.
      // A continuation follows a stop hook such as gollabara feedback, so it keeps its recap.
      // Codex has no such wake-ups (its turns open with a prompt) and no `turnOrigin`: its opener stays unknown
      if (opener === 'system' && !input.stop_hook_active)
        return null
      const text = recapOf(input.last_assistant_message)
      if (!text)
        return null
      // A second Stop after another stop hook let the turn continue; both recaps matter.
      // A wake-up's Stop also comes as `stop_hook_active`, but the turn is new: the session sat idle before it
      return input.stop_hook_active && opener !== 'rewake' ? { kind: 'recap', session, text, continuation: true } : { kind: 'recap', session, text }
    }
    // Claude Code and Codex both send it as the session closes; the server refuses feedback to it from then on
    case 'SessionEnd':
      return { kind: 'session-end', session }
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

/**
 * Where the hook claims the session's feedback, or null when it must not claim: the claim marks items
 * delivered. The adapter can refuse a hook point (Codex, a Stop that is already continuing).
 */
export function feedbackVia(hookEventName: string, input?: Pick<HookInput, 'stop_hook_active'>, adapter: Adapter = 'claude-code'): FeedbackVia | null {
  if (!ADAPTERS[adapter].claims(hookEventName, input))
    return null
  return FEEDBACK_VIA[hookEventName] ?? null
}

/** Hook stdout JSON that hands claimed feedback to the session, or null when there is nothing to print */
export function feedbackOutput(hookEventName: string, items: Feedback[], adapter: Adapter = 'claude-code'): object | null {
  if (items.length === 0 || !FEEDBACK_VIA[hookEventName])
    return null
  return ADAPTERS[adapter].output(hookEventName, feedbackText(items))
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
 * Finds images in a tool result. The shapes supported:
 * - built-in Read: { type: 'image', file: { base64, type, dimensions } }
 * - MCP content array: [{ type: 'image', data, mimeType }]
 * - Codex `view_image`: [{ type: 'input_image', image_url: 'data:<mime>;base64,…' }]
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
    if (node.type === 'input_image' && typeof node.image_url === 'string') {
      const image = dataUrlImage(node.image_url)
      if (image)
        out.push(image)
      return
    }
    for (const value of Object.values(node)) visit(value, depth + 1)
  }
  visit(response, 0)
  return out
}

/**
 * A base64 data URL as an image. Codex labels some `application/octet-stream`, so a type that is not
 * `image/*` is sniffed from the bytes; anything that is not a known image (or not a data URL) is skipped.
 */
export function dataUrlImage(url: string): IncomingImage | null {
  const match = /^data:([^;,]*)((?:;[^;,]*)*),/.exec(url)
  if (!match || !match[2]!.split(';').includes('base64'))
    return null
  const data = url.slice(match[0].length)
  const mime = match[1]!.toLowerCase().startsWith('image/') ? match[1]!.toLowerCase() : sniffImageMime(data)
  return mime ? { data, mime } : null
}

/** The image type from a base64 payload's first bytes: PNG, JPEG, GIF or WebP */
export function sniffImageMime(base64: string): string | undefined {
  const head = Buffer.from(base64.slice(0, 24), 'base64')
  const ascii = (from: number, to: number) => head.subarray(from, to).toString('latin1')
  if (head[0] === 0x89 && ascii(1, 4) === 'PNG')
    return 'image/png'
  if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF)
    return 'image/jpeg'
  if (ascii(0, 4) === 'GIF8')
    return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    return 'image/webp'
  return undefined
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

/**
 * How the user answered AskUserQuestion, whether in the terminal or through the app's `ask` hold: Claude Code
 * hands the answers, keyed by question text (multiSelect labels joined with ", "), to PostToolUse.
 */
function answerEvent(input: HookInput, session: SessionInfo): IncomingEvent | null {
  const raw = input.tool_response?.answers ?? input.tool_input?.answers
  if (typeof input.tool_use_id !== 'string' || !input.tool_use_id || !raw || typeof raw !== 'object' || Array.isArray(raw))
    return null
  const answers = Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string'))
  return Object.keys(answers).length ? { kind: 'answer', session, questionId: input.tool_use_id, answers } : null
}

export function extractQuestions(toolInput: any): Question[] {
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
