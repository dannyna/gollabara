<script setup lang="ts">
import { ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import SettingsSheet from './SettingsSheet.vue'

// Not used in the app yet: nothing there deletes files. This is the shape for when
// a shorter retention actually removes artifacts.
const saved = { server: 'http://127.0.0.1:4747', phone: '', retention: '30' as const }
function noop() {}

const sheetOpen = ref(false)
const confirmOpen = ref(false)
const result = ref('')
function decide(ok: boolean) {
  confirmOpen.value = false
  result.value = ok ? '줄이고 지우기를 골랐어요' : '취소했어요'
}
</script>

<template>
  <GalleryCase title="설정 시트 위 · 시트의 스크림을 그대로 씀 · 첫 포커스는 취소">
    <GalleryStage :height="600">
      <SettingsSheet :settings="saved" theme="dark" preview @close="noop" />
      <ConfirmDialog title="보관 기간을 7일로 줄일까요?" confirm-label="줄이고 지우기" over-sheet preview>
        <b>7일보다 오래된 산출물</b>이 이 기기에서 지워지고, 되돌릴 수 없어요. 세션 대화의 리캡과 질문은 남아요.
      </ConfirmDialog>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="단독 · 스크림 (≤767px에서는 아래에 붙고 버튼이 세로로)">
    <GalleryStage :height="420">
      <ConfirmDialog title="보관 기간을 7일로 줄일까요?" confirm-label="줄이고 지우기" preview>
        <b>7일보다 오래된 산출물</b>이 이 기기에서 지워지고, 되돌릴 수 없어요.
      </ConfirmDialog>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="직접 열어 보기 · Esc와 스크림은 취소 · 시트는 열린 채">
    <GalleryStage :height="640">
      <div class="demo">
        <button class="secondary" type="button" @click="sheetOpen = true">
          설정 열기
        </button>
        <p class="mono">
          {{ result || '결과 없음' }}
        </p>
      </div>
      <template v-if="sheetOpen">
        <SettingsSheet :settings="saved" theme="dark" @close="sheetOpen = false" @save="confirmOpen = true" />
        <ConfirmDialog
          v-if="confirmOpen" title="보관 기간을 7일로 줄일까요?" confirm-label="줄이고 지우기" over-sheet
          @cancel="decide(false)" @confirm="decide(true)"
        >
          <b>7일보다 오래된 산출물</b>이 이 기기에서 지워지고, 되돌릴 수 없어요.
        </ConfirmDialog>
      </template>
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
