// The Claude Code adapter: what only Claude Code's hooks need on top of the shared core (map.ts, core.ts).
// Its transcript tells who opened a turn and when, and Open Design runs it under OD_PROJECT_ID.

import type { HarnessAdapter, TurnOpener } from './map'
import { FEEDBACK_PREFIX } from '../shared/feedback'
import { fromTail, TRANSCRIPT_TAIL_WINDOWS } from './transcript'

/** `turnOrigin` values seen on real transcripts. A value not listed here counts as unknown, so the recap still posts */
const HUMAN_TURN_ORIGINS = new Set(['human', 'sdk'])
const WAKE_UP_TURN_ORIGINS = new Set(['task_notification', 'peer', 'system', 'scheduled'])

/**
 * Classifies the turn from the tail of a Claude Code transcript (JSONL). Only the entry that
 * opens a turn carries `turnOrigin`, so the last one in the tail is the current turn's.
 * Feedback gollabara delivered after that opener makes the turn the user's: they wait on the reply. So does a wake-up
 * (a `task_notification` turn whose system reminder carries the feedback), told apart as `rewake`.
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
    if (isRewakeFeedback(entry))
      return 'rewake'
    return HUMAN_TURN_ORIGINS.has(entry.turnOrigin) ? 'human' : WAKE_UP_TURN_ORIGINS.has(entry.turnOrigin) ? 'system' : 'unknown'
  }
  return 'unknown'
}

/**
 * When the current turn started: the timestamp of the last main-thread entry that opened a turn.
 * Unlike turnOpener, feedback delivered after the opener does not stop the scan: it changes who
 * the turn is for, not when it began. Undefined when the tail holds no opener.
 */
export function turnStartedAt(tail: string): number | undefined {
  const lines = tail.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.includes('"turnOrigin"'))
      continue
    let entry: any
    try {
      entry = JSON.parse(line)
    }
    catch {
      continue
    }
    if (entry?.isSidechain || entry?.type !== 'user' || typeof entry.turnOrigin !== 'string')
      continue
    const at = Date.parse(entry.timestamp)
    return Number.isFinite(at) ? at : undefined
  }
  return undefined
}

/** Who opened the turn, from the transcript's tail; 'unknown' (so the recap is posted) when it can't be read */
export function stopTurnOpener(transcriptPath?: string, windows = TRANSCRIPT_TAIL_WINDOWS): TurnOpener {
  return fromTail(transcriptPath, (text) => {
    const opener = turnOpener(text)
    return opener === 'unknown' ? undefined : opener
  }, windows) ?? 'unknown'
}

/** Hook context that handed gollabara feedback to the session (PostToolUse, Stop or UserPromptSubmit) */
function isFeedbackDelivery(entry: any): boolean {
  const attachment = entry?.type === 'attachment' ? entry.attachment : undefined
  return attachment?.type === 'hook_additional_context'
    && Array.isArray(attachment.content)
    && attachment.content.some((c: unknown) => typeof c === 'string' && c.startsWith(FEEDBACK_PREFIX))
}

/** A turn gollabara's wake-up Stop hook opened: its stderr, the feedback, lands in the system reminder */
function isRewakeFeedback(entry: any): boolean {
  return entry?.origin?.kind === 'task-notification' && carriesFeedback(entry)
}

function carriesFeedback(entry: any): boolean {
  const content = entry.message?.content
  const texts: unknown[] = typeof content === 'string' ? [content] : Array.isArray(content) ? content.map((c: any) => c?.text) : []
  return texts.some(t => typeof t === 'string' && t.includes(FEEDBACK_PREFIX))
}

export const claudeCode: HarnessAdapter = {
  project: env => env.OD_PROJECT_ID,
  // Every Stop: a wake-up's Stop comes as `stop_hook_active` too, yet opens its own turn
  stopOpener: transcriptPath => stopTurnOpener(transcriptPath),
  turnStartedAt,
  claims: () => true,
  // On Stop this keeps the turn going without the error notice `decision: block` shows;
  // the claim already emptied the queue, so the re-entered Stop lets it end
  output: (hookEventName, text) => ({ hookSpecificOutput: { hookEventName, additionalContext: text } }),
}
