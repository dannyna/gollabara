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
  // JSON quoting keeps the recap on one line and escapes its own quotes
  const reply = item.quote ? `, replying to your message from ${clock(item.quote.at)}: ${JSON.stringify(item.quote.text)}` : ''
  return `${FEEDBACK_PREFIX} while you work (sent ${clock(item.createdAt)}${about}${reply}): ${item.text}`
}

/** Longest quoted recap line, in characters */
export const QUOTE_MAX = 300

/** A recap line as feedback quotes it: one line, trimmed, at most QUOTE_MAX characters (code points, so no emoji splits) */
export function quoteText(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, QUOTE_MAX).join('').trimEnd()
}

/** Claimed items, one line each, oldest first */
export function feedbackText(items: Feedback[]): string {
  return items.map(feedbackLine).join('\n')
}

function clock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
