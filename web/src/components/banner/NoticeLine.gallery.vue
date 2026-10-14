<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import NoticeLine from './NoticeLine.vue'
</script>

<template>
  <GalleryCase title="offline · under the chat heading">
    <div class="panel">
      <div class="heading">
        <strong>세션 대화</strong><span>질문에 답하고, 피드백을 남겨요</span>
      </div>
      <NoticeLine>연결을 기다리는 중이에요. 이전 대화는 계속 볼 수 있어요.</NoticeLine>
      <p class="feed">
        14:35 · od · landing-hero — 히어로 시안 3개 뽑았어.
      </p>
    </div>
  </GalleryCase>
  <GalleryCase title="restored · folded at once">
    <div class="panel">
      <div class="heading">
        <strong>세션 대화</strong><span>질문에 답하고, 피드백을 남겨요</span>
      </div>
      <p class="feed">
        14:35 · od · landing-hero — 히어로 시안 3개 뽑았어.
      </p>
    </div>
  </GalleryCase>
</template>

<style scoped>
.panel {
  max-width: 440px;
  margin: 0 18px;
  overflow: hidden;
  border-radius: 24px;
  background: var(--surface);
}
.heading {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  font-size: 13px;
}
.heading strong {
  font-weight: 500;
}
.heading span {
  font-size: 10px;
  color: var(--muted);
}
.feed {
  padding: 16px 24px 20px;
  font-size: 12px;
}
@media (max-width: 767px) {
  .panel {
    margin: 0;
    border-radius: 22px 22px 0 0;
  }
  .heading {
    height: 40px;
    padding: 0 18px;
    font-size: 11px;
  }
  .heading span {
    font-size: 9px;
  }
}
</style>
