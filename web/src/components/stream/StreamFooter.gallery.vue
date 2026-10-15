<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import StreamFooter from './StreamFooter.vue'
</script>

<template>
  <GalleryCase title="처음 열기 · 최신 위치, 아직 스크롤 전">
    <div class="frame">
      <StreamFooter follow="start" />
    </div>
  </GalleryCase>
  <GalleryCase title="오른쪽 끝에서 70 안 · 따라가는 중">
    <div class="frame">
      <StreamFooter follow="following" />
    </div>
  </GalleryCase>
  <GalleryCase title="뒤로 스크롤 · 자동 따라가기 일시 정지">
    <div class="frame">
      <StreamFooter follow="paused" />
    </div>
  </GalleryCase>
  <GalleryCase title="셀 고정 · 푸는 방법은 fg (터치 화면은 「다시 눌러 풀기」)">
    <div class="frame">
      <StreamFooter follow="paused" pinned />
    </div>
  </GalleryCase>
</template>

<style scoped>
.frame {
  margin: 0 18px;
  border-radius: 20px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
@media (max-width: 767px) {
  .frame {
    margin: 0 12px;
  }
}
</style>
