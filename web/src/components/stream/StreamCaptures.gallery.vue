<script setup lang="ts">
// Re-captures of one screen and session runs on the rail (#33)
import GalleryCase from '../../gallery/GalleryCase.vue'
import { CAPTURE_SAMPLES as S } from './gallery-samples'
import StreamRail from './StreamRail.vue'
</script>

<template>
  <GalleryCase title="같은 화면 2장 · 최신 캡처만 보이고 캡션에 「같은 화면 2장」 · 순번 하나">
    <div class="frame">
      <StreamRail bare :artifacts="S.two()" />
    </div>
  </GalleryCase>
  <GalleryCase title="같은 화면 5장 · 한 칸, 같은 파일을 다섯 번 다시 찍음">
    <div class="frame">
      <StreamRail bare :artifacts="S.five()" />
    </div>
  </GalleryCase>
  <GalleryCase title="섞임 · login 두 장 뒤에 다른 화면 둘, 다시 찍은 login은 끝으로 옮기고 번호는 셋">
    <div class="frame">
      <StreamRail bare :artifacts="S.mixed()" />
    </div>
  </GalleryCase>
  <GalleryCase title="파일 이름이 없음 · 바이트가 같은 두 장만 합쳐짐, 메타에 파일 이름 없음">
    <div class="frame">
      <StreamRail bare :artifacts="S.identical()" />
    </div>
  </GalleryCase>
  <GalleryCase title="긴 런 · 같은 세션 5분 안 · 세션 이름은 처음 한 번, 사이 간격 10">
    <div class="frame">
      <StreamRail bare :artifacts="S.longRun()" />
    </div>
  </GalleryCase>
  <GalleryCase title="번갈아 · od, od, piuda, od → 런 셋, 런 사이 점선">
    <div class="frame">
      <StreamRail bare :artifacts="S.interleaved()" />
    </div>
  </GalleryCase>
  <GalleryCase title="시간 간격 · 같은 세션이어도 5분 넘게 쉬면 새 런 (14:32 → 14:39)">
    <div class="frame">
      <StreamRail bare :artifacts="S.gap()" />
    </div>
  </GalleryCase>
  <GalleryCase title="런 안에 숨은 중복 · login 세 장이 한 칸으로">
    <div class="frame">
      <StreamRail bare :artifacts="S.hiddenInRun()" />
    </div>
  </GalleryCase>
</template>

<style scoped>
.frame {
  height: 460px;
  margin: 0 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 20px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
@media (max-width: 767px) {
  .frame {
    margin: 0 12px;
  }
}
</style>
