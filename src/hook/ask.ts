// `golla hook ask` — the second PreToolUse hook on AskUserQuestion (Claude Code only, opt-in). It holds the
// session's question for up to ANSWER_HOLD_MS so the user can answer it from the app. The server says at once
// when nobody can: the setting is off, or no viewer is connected. An answer goes back to Claude Code as the
// tool's input, which skips the terminal dialog; every other ending is a quiet exit 0, and the dialog appears.
// Claude Code shows "running PreToolUse hooks…" meanwhile, and Esc ends the turn and kills this hook.

import type { HookInput } from './map'
import process from 'node:process'
import { ANSWER_HOLD_MS } from '../shared/answer'
import { serverUrl } from '../shared/config'
import { HOOK_HARNESS_HEADER, HOOK_VERSION_HEADER, PLUGIN_VERSION } from '../shared/version'
import { HARD_DEADLINE_MS } from './core'
import { extractQuestions } from './map'
import { headless } from './wait'

/** The whole run, from process start; the server ends a hold at ANSWER_HOLD_MS, so this is only a backstop */
export const ASK_DEADLINE_MS = ANSWER_HOLD_MS + 5000
/** Past the server's own end of the hold, so a healthy hold never times out here */
const HOLD_TIMEOUT_MS = ANSWER_HOLD_MS + 2000

/**
 * The PreToolUse output that answers AskUserQuestion: Claude Code skips its dialog and the model reads the
 * answers as if typed. The questions go back exactly as the session asked them.
 */
export function askOutput(toolInput: any, answers: Record<string, string>): object {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { questions: toolInput?.questions, answers },
    },
  }
}

/** The answers a hold response carries, or null for `{ hold: false }` and anything malformed */
export function heldAnswers(body: unknown): Record<string, string> | null {
  const answers = (body as { answers?: unknown } | null)?.answers
  if (!answers || typeof answers !== 'object' || Array.isArray(answers))
    return null
  const entries = Object.entries(answers)
  return entries.length && entries.every(([, v]) => typeof v === 'string') ? answers as Record<string, string> : null
}

/** Never throws and never prints anything but the answer JSON */
export async function runAsk(): Promise<void> {
  // Headless runs have no one to answer; Open Design runs carry a tool token in their env and are not covered
  if (process.env.GOLLABARA_HOOK === 'off' || headless(process.env.CLAUDE_CODE_ENTRYPOINT) || process.env.OD_PROJECT_ID)
    return
  try {
    let timer: ReturnType<typeof setTimeout> | undefined
    const raw = await Promise.race([
      Bun.stdin.text(),
      new Promise<null>((resolve) => {
        timer = setTimeout(resolve, HARD_DEADLINE_MS, null)
      }),
    ])
    clearTimeout(timer)
    if (raw === null)
      return
    const input = JSON.parse(raw) as HookInput
    if (input.tool_name !== 'AskUserQuestion' || !input.session_id || typeof input.tool_use_id !== 'string' || !input.tool_use_id)
      return
    const questions = extractQuestions(input.tool_input)
    if (!questions.length)
      return
    const res = await fetch(`${serverUrl()}/api/questions/hold`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [HOOK_VERSION_HEADER]: PLUGIN_VERSION, [HOOK_HARNESS_HEADER]: 'claude-code' },
      body: JSON.stringify({ sessionId: input.session_id, questionId: input.tool_use_id, questions }),
      signal: AbortSignal.timeout(HOLD_TIMEOUT_MS),
    })
    if (!res.ok)
      return
    const answers = heldAnswers(await res.json())
    // Awaited so the bytes are out before entry.ts calls process.exit
    if (answers)
      await Bun.write(Bun.stdout, JSON.stringify(askOutput(input.tool_input, answers)))
  }
  catch {
    // Server down, a timeout, bad input: the terminal dialog appears as if the hook never ran
  }
}
