<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { IMG, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import MyMessage from './MyMessage.vue'
</script>

<template>
  <GalleryCase title="01 · 보내는 중 (queued)">
    <ChatFrame note="인용한 세션 메시지는 ↪ + 첫 줄.">
      <MyMessage target="piuda" text="e2e도 돌려줘" :quote="{ text: '사이드바 접힘 상태 저장 구현 끝.' }" state="queued" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 전달됨 (delivered)">
    <ChatFrame note="산출물 인용은 썸네일 + 라벨. 전달됨은 가장 최근 말풍선에만.">
      <MyMessage target="od" text="하단 버튼 여백만 줄여 줘" :quote="{ text: '히어로 B', image: IMG.heroB.url }" :at="time(14, 41)" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 전달 못 함 (failed)">
    <ChatFrame note="다시 보내기는 텍스트 링크. 말풍선 색은 그대로 둔다.">
      <MyMessage target="client-e2e" text="결제 버튼 잘림 다시 확인해 줘" state="failed" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="older bubble · 전달 상태 없음">
    <ChatFrame note="앞선 말풍선은 전달 상태를 달지 않는다.">
      <MyMessage target="od" text="CTA 문구는 그대로 둬" state="none" />
      <MyMessage target="od" text="모바일 360px도 한 장 찍어 줘" :at="time(14, 42)" />
    </ChatFrame>
  </GalleryCase>
</template>
