// The text a session reads when gollabara hands it the user's feedback, whichever path delivers it
// (hook context or a wake-up). One builder, so the transcript looks the same either way.
import type { Feedback } from './types'

/** Start of every feedback line, also how a delivery is recognised in the transcript */
export const FEEDBACK_PREFIX = '[gollabara] Feedback from the user'

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

/** Claimed items, one line each, oldest first */
export function feedbackText(items: Feedback[]): string {
  return items.map(feedbackLine).join('\n')
}

function clock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
