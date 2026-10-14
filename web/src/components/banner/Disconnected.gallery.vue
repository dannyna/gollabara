<script setup lang="ts">
// The disconnected combination (OD banner guide 04) on the real shell: the chip says
// the state, the chat note says what still works, the stream stays as it was.
import { toArtifacts } from '../../artifacts'
import GalleryCase from '../../gallery/GalleryCase.vue'
import AppBar from '../shell/AppBar.vue'
import ChatPanel from '../shell/ChatPanel.vue'
import StreamPanel from '../shell/StreamPanel.vue'
import { SAMPLE_MESSAGES } from './gallery-samples'

const artifacts = toArtifacts(SAMPLE_MESSAGES)
</script>

<template>
  <GalleryCase title="offline · chip + chat note, stream untouched">
    <div class="app">
      <AppBar offline />
      <main class="workspace">
        <StreamPanel :artifacts="artifacts" />
        <ChatPanel :messages="SAMPLE_MESSAGES" offline />
      </main>
    </div>
  </GalleryCase>
  <GalleryCase title="restored · note folded, sending back on">
    <div class="app">
      <AppBar />
      <main class="workspace">
        <StreamPanel :artifacts="artifacts" />
        <ChatPanel :messages="SAMPLE_MESSAGES" />
      </main>
    </div>
  </GalleryCase>
</template>

<style scoped>
/* Same layout as App.vue, held to a fixed height */
.app {
  height: 680px;
  display: flex;
  flex-direction: column;
  padding: 0 18px 18px;
}
.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 440px;
  gap: 16px;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .app {
    padding: 0 14px 14px;
  }
  .workspace {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .workspace > .stream-panel {
    height: 43%;
    flex: none;
  }
  .workspace > .chat-panel {
    flex: 1;
  }
}
@media (max-width: 767px) {
  .app {
    padding: 0;
  }
  .workspace {
    display: block;
  }
  .workspace > .chat-panel {
    height: 100%;
  }
}
</style>
