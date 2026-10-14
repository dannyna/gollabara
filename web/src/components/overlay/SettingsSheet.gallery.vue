<script setup lang="ts">
import type { Settings } from '../../settings'
import type { ThemePreference } from '../../theme'
import { onMounted, ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import AppToast from './AppToast.vue'
import SettingsSheet from './SettingsSheet.vue'
import { useToast } from './useToast'

const saved: Settings = { server: 'http://127.0.0.1:4747', phone: 'https://my-mac.ts.net', retention: '30' }
// Gallery theme picks stay local; they never touch the app's stored theme
const theme = ref<ThemePreference>('dark')

const scrolled = ref<HTMLElement>()
onMounted(() => {
  const sheet = scrolled.value?.querySelector('.sheet')
  if (sheet)
    sheet.scrollTop = 150
})

const open = ref(false)
const live = ref<Settings>({ ...saved })
const { toast } = useToast()
function onSave(next: Settings) {
  live.value = next
  open.value = false
  toast('이 브라우저에 설정을 저장했어요')
}
</script>

<template>
  <GalleryCase title="열림 · 머리 · 본문 · 발 (≤767px에서는 아래에서 올라와요)">
    <GalleryStage :height="680">
      <SettingsSheet :settings="saved" :theme="theme" preview />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="스크롤해도 머리와 저장 버튼은 고정">
    <GalleryStage :height="480">
      <div ref="scrolled">
        <SettingsSheet :settings="saved" theme="system" preview />
      </div>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="입력 오류 · 필드 아래 fg 글자와 아이콘">
    <GalleryStage :height="680">
      <SettingsSheet :settings="saved" :draft="{ phone: 'http://my-mac.ts.net' }" :theme="theme" validate preview />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="저장됨 · 시트를 닫고 토스트">
    <GalleryStage :height="200">
      <AppToast text="이 브라우저에 설정을 저장했어요" />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="모바일 · 오른쪽 시트 그대로 (지금 앱의 대안, 390에서 확인)">
    <GalleryStage :height="680">
      <SettingsSheet :settings="saved" theme="light" mobile="side" preview />
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="직접 열어 보기 · Esc · 스크림 · Tab 가둠 · 포커스 복귀">
    <GalleryStage :height="680">
      <button class="secondary demo-trigger" type="button" @click="open = true">
        설정 열기
      </button>
      <SettingsSheet v-if="open" v-model:theme="theme" :settings="live" @close="open = false" @save="onSave" />
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
