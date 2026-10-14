// The image the user picked to leave feedback on. The viewer sets it; the chat
// composer reads it later and delivers it. Nothing here sends to a session.

import { ref } from 'vue'

export interface FeedbackTarget {
  sessionId: string
  imageUrl: string
  /** When the image arrived */
  at: number
  caption?: string
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
