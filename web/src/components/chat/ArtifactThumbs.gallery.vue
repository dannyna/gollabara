<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { IMG } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import ArtifactThumbs from './ArtifactThumbs.vue'

const one = [{ key: 'a', ...IMG.hero }]
const mixed = [
  { key: '1', label: '1', ...IMG.c1 },
  { key: '2', label: '2', ...IMG.c2 },
  { key: '3', label: '3', ...IMG.hero },
  { key: '4', label: '4', ...IMG.c1 },
  { key: '5', label: '5', ...IMG.heroB },
]
</script>

<template>
  <GalleryCase title="1장 · 도구 이름 없음 (turn)">
    <ChatFrame note="턴에는 도구 이름이 없어 장수만 쓴다.">
      <ArtifactThumbs :thumbs="one" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="여러 장 · 세로 · 가로 섞임 · 넘치면 가로 스크롤">
    <ChatFrame note="높이만 맞추고 원본 비율을 지킨다.">
      <ArtifactThumbs :thumbs="mixed" tool-name="Read" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="선택 · fg 외곽선">
    <ChatFrame>
      <ArtifactThumbs :thumbs="mixed.slice(0, 3)" tool-name="mcp__open-design__screenshot" active="2" />
    </ChatFrame>
  </GalleryCase>
</template>
