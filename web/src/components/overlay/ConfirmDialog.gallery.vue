<script setup lang="ts">
import { ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import ConfirmDialog from './ConfirmDialog.vue'

// The app asks this before 「이 세션 데이터 삭제」 (on its own scrim)
const confirmOpen = ref(false)
const result = ref('')
function decide(ok: boolean) {
  confirmOpen.value = false
  result.value = ok ? '지우기를 골랐어요' : '취소했어요'
}
</script>

<template>
  <GalleryCase title="단독 · 스크림 (≤767px에서는 아래에 붙고 버튼이 세로로) · 아바타 메뉴의 세션 데이터 삭제">
    <GalleryStage :height="420">
      <ConfirmDialog title="gollabara · feat/expiry 세션의 데이터를 지울까요?" confirm-label="지우기" preview>
        이 세션의 메시지와 피드백, 다른 세션과 같이 쓰지 않는 이미지가 이 Mac에서 지워지고, 되돌릴 수 없어요.
      </ConfirmDialog>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="직접 열어 보기 · Esc와 스크림은 취소">
    <GalleryStage :height="420">
      <div class="demo">
        <button class="secondary" type="button" @click="confirmOpen = true">
          세션 데이터 삭제
        </button>
        <p class="mono">
          {{ result || '결과 없음' }}
        </p>
      </div>
      <ConfirmDialog
        v-if="confirmOpen" title="gollabara · feat/expiry 세션의 데이터를 지울까요?" confirm-label="지우기"
        @cancel="decide(false)" @confirm="decide(true)"
      >
        이 세션의 메시지와 피드백, 다른 세션과 같이 쓰지 않는 이미지가 이 Mac에서 지워지고, 되돌릴 수 없어요.
      </ConfirmDialog>
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
