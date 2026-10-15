// Opens the app's one image viewer from anywhere: stream cells and chat thumbnails.
// App renders <ImageViewer v-model="openKey">; callers pass a capture key
// (artifactKey(messageId, index)). A capture hidden behind a newer one of the same
// screen opens its cell, on that capture.

import { ref } from 'vue'
import { useCaptures } from '../../captures'

const openKey = ref<string | null>(null)
/** The capture asked for, so the viewer can start on it rather than on the newest */
const openCapture = ref<string | null>(null)

export function useImageViewer() {
  const { cellKey } = useCaptures()
  return {
    openKey,
    openCapture,
    /** Opens on one capture: a chat thumbnail */
    open: (key: string) => {
      openCapture.value = key
      openKey.value = cellKey(key)
    },
    /** Opens a stream cell on its newest capture */
    openCell: (key: string) => {
      openCapture.value = null
      openKey.value = key
    },
    close: () => {
      openKey.value = null
    },
  }
}
