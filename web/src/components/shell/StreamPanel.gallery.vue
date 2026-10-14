<script setup lang="ts">
import { onMounted, ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import { ALL, rail } from '../stream/gallery-samples'
import StreamPanel from './StreamPanel.vue'

const artifacts = rail(ALL)
const last = artifacts.at(-1)!.key
const heroC = artifacts.find(a => a.label?.startsWith('히어로 C'))!.key

const selected = ref<string | null>(last)
const centered = ref<InstanceType<typeof StreamPanel>>()
onMounted(() => centered.value?.reveal(heroC, 'instant'))
</script>

<template>
  <GalleryCase title="최신 위치 · 따라가는 중 · 마지막 셀 선택 (다시 누르면 뷰어)">
    <div class="frame">
      <StreamPanel :artifacts="artifacts" :selected="selected" @select="selected = $event" />
    </div>
  </GalleryCase>
  <GalleryCase title="이전 산출물을 보는 중 · 새 산출물 2 · 바닥은 일시 정지">
    <div class="frame">
      <StreamPanel :artifacts="artifacts" :selected="last" :preview="{ unseen: 2 }" />
    </div>
  </GalleryCase>
  <GalleryCase title="대화 썸네일에서 골라 가운데로 · 히어로 C">
    <div class="frame">
      <StreamPanel ref="centered" :artifacts="artifacts" :selected="heroC" />
    </div>
  </GalleryCase>
  <GalleryCase title="빈 스트림 · 전체 세션">
    <div class="frame short">
      <StreamPanel :artifacts="[]" />
    </div>
  </GalleryCase>
  <GalleryCase title="빈 스트림 · 한 세션만 보는 중">
    <div class="frame short">
      <StreamPanel :artifacts="[]" scope="od" />
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
