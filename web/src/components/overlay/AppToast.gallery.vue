<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import AppToast from './AppToast.vue'
import { useToast } from './useToast'

const { toast } = useToast()
const MESSAGES = ['이 브라우저에 설정을 저장했어요', '설치 명령을 복사했어요']
let n = 0
const next = () => toast(MESSAGES[n++ % 2]!)
</script>

<template>
  <GalleryCase title="결과 알림 · fg 면 · 3초 뒤 닫힘">
    <GalleryStage :height="200">
      <AppToast text="이 브라우저에 설정을 저장했어요" />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="다음 할 일 하나 · 클립보드에 쓸 수 없을 때">
    <GalleryStage :height="200">
      <AppToast text="명령을 선택했어요. 복사해 주세요" />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="너무 긴 문구 · 390에서 줄이 넘어가면 필드 아래 오류로 옮겨요">
    <GalleryStage :height="200">
      <AppToast text="주소를 확인해 주세요. 폰용 주소는 https://로 입력하세요." />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="직접 띄워 보기 · 쌓지 않고 글을 바꾸며 3초를 다시 셈">
    <GalleryStage :height="200">
      <button class="secondary demo-trigger" type="button" @click="next">
        토스트 띄우기
      </button>
      <AppToast />
    </GalleryStage>
  </GalleryCase>
</template>

<style scoped>
.demo-trigger {
  position: absolute;
  top: 24px;
  left: 24px;
}
</style>
