<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import AppBar from '../shell/AppBar.vue'
import ConnectionChip from './ConnectionChip.vue'
</script>

<template>
  <GalleryCase title="online · 칩 없음">
    <div class="identity">
      <span class="wordmark">gollabara</span>
      <ConnectionChip status="online" />
    </div>
  </GalleryCase>
  <GalleryCase title="offline · 다시 연결 중">
    <div class="identity">
      <span class="wordmark">gollabara</span>
      <ConnectionChip status="offline" />
    </div>
  </GalleryCase>
  <GalleryCase title="restored · 다시 연결됐어요, hidden after 3 s">
    <div class="identity">
      <span class="wordmark">gollabara</span>
      <ConnectionChip status="restored" />
    </div>
  </GalleryCase>
  <GalleryCase title="in AppBar · today's inline chip, end of the first row on mobile">
    <AppBar offline />
  </GalleryCase>
</template>

<style scoped>
/* Mirrors the app-bar identity row: logo side, 15 gap, chip at the right end on mobile */
.identity {
  height: 56px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 15px;
}
.wordmark {
  font: 500 25px/1 var(--display);
  letter-spacing: -1.3px;
}
@media (max-width: 767px) {
  .identity {
    justify-content: space-between;
  }
  .wordmark {
    font-size: 24px;
  }
}
</style>
