<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import AppBar from './AppBar.vue'
import EmptyState from './EmptyState.vue'
import { GUIDES } from './gallery-samples'
</script>

<template>
  <GalleryCase title="서버 응답 없음 · 1단계가 지금, 나머지는 대기">
    <div class="app">
      <AppBar :show-session-button="false" />
      <EmptyState />
    </div>
  </GalleryCase>
  <GalleryCase title="서버 실행 중 · 연결된 하네스 없음 · bunx gollabara setup">
    <div class="app">
      <AppBar :show-session-button="false" />
      <EmptyState connected :guide="GUIDES.none" />
    </div>
  </GalleryCase>
  <GalleryCase title="Claude Code · Codex 연결됨 · 세션을 시작해 보세요">
    <div class="app">
      <AppBar :show-session-button="false" />
      <EmptyState connected :guide="GUIDES.connected" />
    </div>
  </GalleryCase>
  <GalleryCase title="플러그인이 오래됨 · 세션 다시 시작 또는 golla update">
    <div class="app">
      <AppBar :show-session-button="false" />
      <EmptyState connected :guide="GUIDES.outdated" />
    </div>
  </GalleryCase>
</template>

<style scoped>
.app {
  height: 760px;
  display: flex;
  flex-direction: column;
  padding: 0 18px 18px;
}
@media (max-width: 767px) {
  .app {
    padding: 0;
  }
}
</style>
