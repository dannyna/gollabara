<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import StateView from './StateView.vue'
</script>

<template>
  <GalleryCase title="stream · session filter, nothing yet">
    <div class="area stream">
      <StateView title="이 세션에는 아직 산출물이 없어요." />
    </div>
  </GalleryCase>
  <GalleryCase title="stream · every session muted">
    <div class="area stream">
      <StateView icon="mute" title="모든 세션을 음소거했어요" description="세션 목록에서 다시 표시할 수 있어요." action="세션 목록 열기" />
    </div>
  </GalleryCase>
  <GalleryCase title="chat · muted session">
    <div class="area chat">
      <StateView title="음소거한 세션이에요." description="세션 목록에서 다시 표시할 수 있어요." />
    </div>
  </GalleryCase>
</template>

<style scoped>
.area {
  height: 280px;
  margin: 0 18px;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
}
.stream {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.chat {
  max-width: 440px;
  background: var(--surface);
}
@media (max-width: 767px) {
  .area {
    margin: 0;
  }
}
</style>
