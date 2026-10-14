<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import { SAMPLE_ARTIFACTS } from './gallery-samples'
import ImageViewer from './ImageViewer.vue'
import { useFeedbackTarget } from './useFeedbackTarget'
import { useImageViewer } from './useImageViewer'

function noop() {}
const { openKey, open } = useImageViewer()
const { target } = useFeedbackTarget()
</script>

<template>
  <GalleryCase title="열림 · 03 / 06">
    <GalleryStage :height="540">
      <ImageViewer :items="SAMPLE_ARTIFACTS" model-value="3-0" preview @update:model-value="noop" />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="확대 200% · 끌어서 옮기기">
    <GalleryStage :height="540">
      <ImageViewer :items="SAMPLE_ARTIFACTS" model-value="3-0" :initial-zoom="2" preview @update:model-value="noop" />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="첫 장 · 이전 꺼짐">
    <GalleryStage :height="540">
      <ImageViewer :items="SAMPLE_ARTIFACTS" model-value="1-0" preview @update:model-value="noop" />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="마지막 장 · 세로 화면 · 다음 꺼짐">
    <GalleryStage :height="720">
      <ImageViewer :items="SAMPLE_ARTIFACTS" model-value="6-0" preview @update:model-value="noop" />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="직접 열어 보기 · ←/→ · Ctrl+휠 · 「이 이미지에 피드백」은 뷰어를 닫고 대상을 정해요">
    <GalleryStage :height="600">
      <div class="demo">
        <button class="secondary" type="button" @click="open('2-0')">
          뷰어 열기
        </button>
        <p class="mono">
          피드백 대상 · {{ target ? `${target.sessionId} · ${target.caption}` : '없음' }}
        </p>
      </div>
      <ImageViewer v-if="openKey" v-model="openKey" :items="SAMPLE_ARTIFACTS" />
    </GalleryStage>
  </GalleryCase>
</template>

<style scoped>
.demo {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
</style>
