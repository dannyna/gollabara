<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import StateView from '../banner/StateView.vue'
import { GUIDES } from './gallery-samples'
import HarnessGuide from './HarnessGuide.vue'
</script>

<template>
  <GalleryCase title="stream · 연결된 하네스 없음 · bunx gollabara setup">
    <div class="area stream">
      <StateView title="아직 산출물이 없어요.">
        <HarnessGuide :guide="GUIDES.none" place="stream" />
      </StateView>
    </div>
  </GalleryCase>
  <GalleryCase title="stream · Claude Code · Codex 연결됨, 오늘 세션 없음 · 세션 시작">
    <div class="area stream">
      <StateView title="아직 산출물이 없어요.">
        <HarnessGuide :guide="GUIDES.connected" place="stream" />
      </StateView>
    </div>
  </GalleryCase>
  <GalleryCase title="stream · 세션 작업 중, 이미지 아직 없음">
    <div class="area stream">
      <StateView title="아직 산출물이 없어요.">
        <HarnessGuide :guide="GUIDES.running" place="stream" />
      </StateView>
    </div>
  </GalleryCase>
  <GalleryCase title="stream · 플러그인이 오래됨 · 세션 다시 시작 또는 golla update">
    <div class="area stream">
      <StateView title="아직 산출물이 없어요.">
        <HarnessGuide :guide="GUIDES.outdated" place="stream" />
      </StateView>
    </div>
  </GalleryCase>
  <GalleryCase title="stream · 한 세션만 보는 중 · 끝난 세션">
    <div class="area stream">
      <StateView title="이 세션에는 아직 산출물이 없어요.">
        <HarnessGuide :guide="GUIDES.ended" place="stream" />
      </StateView>
    </div>
  </GalleryCase>
  <GalleryCase title="chat · 아직 대화 없음 · 목록은 스트림이 숨는 767px 이하에서만">
    <div class="area chat">
      <StateView title="아직 대화가 없어요.">
        <HarnessGuide :guide="GUIDES.running" place="chat" />
      </StateView>
    </div>
  </GalleryCase>
  <GalleryCase title="chat · 연결된 하네스 없음">
    <div class="area chat">
      <StateView title="아직 대화가 없어요.">
        <HarnessGuide :guide="GUIDES.none" place="chat" />
      </StateView>
    </div>
  </GalleryCase>
</template>

<style scoped>
.area {
  height: 420px;
  margin: 0 18px;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
}
.stream {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.chat {
  max-width: 440px;
  background: var(--surface);
}
@media (max-width: 767px) {
  .area {
    margin: 0;
  }
}
</style>
