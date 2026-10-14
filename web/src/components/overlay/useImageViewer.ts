// Opens the app's one image viewer from anywhere: stream cells today, chat
// thumbnails later. App renders <ImageViewer v-model="openKey">; callers only
// need an artifact key (artifactKey(messageId, index)).

import { ref } from 'vue'

const openKey = ref<string | null>(null)

export function useImageViewer() {
  return {
    openKey,
    open: (key: string) => {
      openKey.value = key
    },
    close: () => {
      openKey.value = null
    },
  }
}
