<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import NewPill from './NewPill.vue'
</script>

<template>
  <GalleryCase title="stream · browsing back, 새 산출물 2">
    <div class="stream">
      <NewPill kind="artifact" :count="2" />
      <div class="footer">
        <span>이미지는 원래 비율 그대로</span><span class="mono">이전 산출물 · 자동 따라가기 일시 정지</span>
      </div>
    </div>
  </GalleryCase>
  <GalleryCase title="stream · at the latest, no pill">
    <div class="stream">
      <div class="footer">
        <span>이미지는 원래 비율 그대로</span><span class="mono">최신 산출물 · 따라가는 중</span>
      </div>
    </div>
  </GalleryCase>
  <GalleryCase title="stream · real count, never 99+">
    <div class="stream">
      <NewPill kind="artifact" :count="128" />
      <div class="footer">
        <span>이미지는 원래 비율 그대로</span><span class="mono">이전 산출물 · 자동 따라가기 일시 정지</span>
      </div>
    </div>
  </GalleryCase>
  <GalleryCase title="chat · 새 메시지 1, 14 above the composer (mobile has no stream)">
    <div class="chat">
      <div class="feed">
        <NewPill kind="message" :count="1" />
      </div>
      <div class="composer">
        세션에 메시지나 피드백을 남겨보세요
      </div>
    </div>
  </GalleryCase>
</template>

<style scoped>
.stream,
.chat {
  height: 260px;
  margin: 0 18px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
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
.footer {
  height: 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 26px;
  font-size: 10px;
  color: var(--muted);
}
.footer .mono {
  font-size: 10px;
}
.feed {
  flex: 1;
  position: relative;
}
.composer {
  margin: 0 20px 17px;
  padding: 14px 13px;
  border-radius: 16px;
  background: var(--bg);
  color: var(--muted);
  font-size: 12px;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .footer {
    height: 27px;
  }
}
@media (max-width: 767px) {
  .stream,
  .chat {
    margin: 0;
  }
}
</style>
