<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { IMG, S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import ArtifactThumbs from './ArtifactThumbs.vue'
import SessionMessage from './SessionMessage.vue'

const hero = [{ key: 'a', label: 'A', ...IMG.hero }, { key: 'b', label: 'B', ...IMG.heroB }]
const checkout = [{ key: '1', label: '1', ...IMG.c1 }, { key: '2', label: '2', ...IMG.c2 }]
</script>

<template>
  <GalleryCase title="01 · 리캡">
    <ChatFrame note="첫 줄 최대 160자. 넘치면 서버가 …로 자른다.">
      <SessionMessage :name="S.piuda" :at="time(14, 32)">
        사이드바 접힘 상태 저장 구현 끝. 테스트 12개 통과.
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 산출물 묶음">
    <ChatFrame note="썸네일 높이 77 고정, 너비는 원본 비율. 아래에 도구 이름 · 장수.">
      <SessionMessage :name="S.e2e" :at="time(14, 38)">
        결제 화면 2장 찍었어.
        <ArtifactThumbs :thumbs="checkout" tool-name="Read" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 짝 강조">
    <ChatFrame note="스트림에서 히어로 A를 고른 상태. 메시지는 bg 면, 해당 썸네일은 fg 외곽선.">
      <SessionMessage :name="S.od" :at="time(14, 34)" highlighted>
        히어로 시안 두 장 찍었어.
        <ArtifactThumbs :thumbs="hero" tool-name="mcp__open-design__screenshot" active="a" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="turn · 리캡 여러 줄 + 이미지 (stop-hook continuation)">
    <ChatFrame note="한 턴의 리캡은 도착한 순서대로 한 줄씩, 이미지는 그 아래.">
      <SessionMessage :name="S.od" :at="time(14, 34)">
        <p>히어로 시안 두 장 찍었어.</p>
        <p>하단 여백도 같이 줄였어.</p>
        <ArtifactThumbs :thumbs="hero" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="long name · 브랜치 없음">
    <ChatFrame>
      <SessionMessage name="checkout-redesign-experiment · feat/payment-sheet-variants" :at="time(9, 5)">
        결제 시트 변형 세 가지를 나란히 비교할 수 있게 정리했어.
      </SessionMessage>
      <SessionMessage name="gollabara-app" :at="time(9, 7)">
        브랜치가 없는 세션은 디렉터리 이름만.
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
</template>
