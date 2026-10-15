<script setup lang="ts">
import { onMounted, ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import { initialHistory } from '../../history'
import { ALL, rail } from '../stream/gallery-samples'
import { GUIDES } from './gallery-samples'
import StreamPanel from './StreamPanel.vue'

const artifacts = rail(ALL)
const last = artifacts.at(-1)!.key
const heroC = artifacts.find(a => a.label?.startsWith('히어로 C'))!.key

const selected = ref<string | null>(last)
const pinned = ref<string | null>(null)
const centered = ref<InstanceType<typeof StreamPanel>>()
onMounted(() => centered.value?.reveal(heroC, 'instant'))
</script>

<template>
  <GalleryCase title="최신 위치 · 따라가는 중 · 누르면 선택하고 고정, 다시 누르면 풀기 (뷰어는 확대 ↗)">
    <div class="frame">
      <StreamPanel
        :artifacts="artifacts" :selected="selected" :pinned="pinned"
        @select="selected = $event" @pin="pinned = $event"
      />
    </div>
  </GalleryCase>
  <GalleryCase title="히어로 C 고정 · 새 산출물 2는 버튼에만 · 바닥은 고정한 산출물">
    <div class="frame">
      <StreamPanel :artifacts="artifacts" :selected="heroC" :pinned="heroC" :preview="{ unseen: 2 }" />
    </div>
  </GalleryCase>
  <GalleryCase title="이전 산출물을 보는 중 · 새 산출물 2 · 바닥은 일시 정지">
    <div class="frame">
      <StreamPanel :artifacts="artifacts" :selected="last" :preview="{ unseen: 2 }" />
    </div>
  </GalleryCase>
  <GalleryCase title="지난 날짜로 이동 · 그 뒤에 온 산출물 2는 버튼에만 · 누르면 최신으로">
    <div class="frame">
      <StreamPanel :artifacts="artifacts" :history="{ ...initialHistory(), older: true, live: false, behind: { messages: 3, artifacts: 2 } }" />
    </div>
  </GalleryCase>
  <GalleryCase title="지난 날짜로 이동 · 새로 온 것 없음 · 최신으로 →">
    <div class="frame">
      <StreamPanel :artifacts="artifacts" :history="{ ...initialHistory(), live: false }" />
    </div>
  </GalleryCase>
  <GalleryCase title="대화 썸네일에서 골라 가운데로 · 히어로 C">
    <div class="frame">
      <StreamPanel ref="centered" :artifacts="artifacts" :selected="heroC" />
    </div>
  </GalleryCase>
  <GalleryCase title="빈 스트림 · 전체 세션 · 세션 작업 중">
    <div class="frame">
      <StreamPanel :artifacts="[]" :guide="GUIDES.running" />
    </div>
  </GalleryCase>
  <GalleryCase title="빈 스트림 · 전체 세션 · 플러그인이 오래됨">
    <div class="frame">
      <StreamPanel :artifacts="[]" :guide="GUIDES.outdated" />
    </div>
  </GalleryCase>
  <GalleryCase title="빈 스트림 · 한 세션만 보는 중">
    <div class="frame">
      <StreamPanel :artifacts="[]" scope="od" :guide="GUIDES.running" />
    </div>
  </GalleryCase>
  <GalleryCase title="모든 세션 음소거 · 세션 목록으로">
    <div class="frame short">
      <StreamPanel :artifacts="[]" all-muted />
    </div>
  </GalleryCase>
  <GalleryCase title="모바일 ≤767 · 패널은 숨고 산출물은 대화 썸네일로만">
    <p class="note muted">
      767px 이하에서는 위 견본이 모두 비어 보이는 것이 맞습니다.
    </p>
  </GalleryCase>
</template>

<style scoped>
.frame {
  height: 540px;
  margin: 0 18px;
  display: flex;
  flex-direction: column;
}
.frame.short {
  height: 300px;
}
.frame > .stream-panel {
  flex: 1;
}
.note {
  padding: 0 18px;
  font-size: 12px;
}
/* Tablet holds the stream in a 43% band */
@media (min-width: 768px) and (max-width: 1023px) {
  .frame {
    height: 386px;
  }
}
</style>
