// What the user picked to leave feedback on: an image (the viewer and the stream cell's 답장)
// or a session's chat message (its 답장). The chat composer reads it later and delivers it.
// Nothing here sends to a session.

import type { Artifact } from '../../artifacts'
import type { MessageView } from '../../triage'
import { ref } from 'vue'
import { quoteText } from '../../../../src/shared/feedback'
import { artifactCaption } from '../../artifacts'

export interface FeedbackTarget {
  sessionId: string
  /** The image the feedback is about */
  imageUrl?: string
  /** When the image arrived, or when the quoted message was posted */
  at: number
  caption?: string
  /** The chat message replied to: its id, and the recap line quoted */
  quote?: { messageId: number, text: string }
}

/** One shape from every entry point, so the composer quotes them the same way */
export function feedbackTargetOf(a: Artifact): FeedbackTarget {
  return { sessionId: a.sessionId, imageUrl: a.url, at: a.at, caption: artifactCaption(a) }
}

/**
 * A quote-reply on a session's chat message: its latest line on screen, so a line triage hid is never
 * quoted. Questions and messages with no line shown (images only, all folded) have nothing to quote.
 */
export function messageTargetOf(view: MessageView): FeedbackTarget | null {
  const { message } = view
  if (message.kind === 'question' || message.questions?.length || view.folded)
    return null
  const lines = view.parts.flatMap(p => p.type === 'line' ? [p.line] : [])
  const line = lines.findLast(l => !l.weak) ?? lines.at(-1)
  const text = line && quoteText(line.text)
  return text ? { sessionId: message.sessionId, at: message.at, quote: { messageId: message.id, text } } : null
}

const target = ref<FeedbackTarget | null>(null)

export function useFeedbackTarget() {
  return {
    target,
    setTarget: (next: FeedbackTarget) => {
      target.value = next
    },
    clearTarget: () => {
      target.value = null
    },
  }
}
