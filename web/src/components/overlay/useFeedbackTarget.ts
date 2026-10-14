// The image the user picked to leave feedback on. The viewer and the stream cell's
// 답장 set it; the chat composer reads it later and delivers it. Nothing here sends
// to a session.

import type { Artifact } from '../../artifacts'
import { ref } from 'vue'
import { artifactCaption } from '../../artifacts'

export interface FeedbackTarget {
  sessionId: string
  imageUrl: string
  /** When the image arrived */
  at: number
  caption?: string
}

/** One shape from every entry point, so the composer quotes them the same way */
export function feedbackTargetOf(a: Artifact): FeedbackTarget {
  return { sessionId: a.sessionId, imageUrl: a.url, at: a.at, caption: artifactCaption(a) }
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
