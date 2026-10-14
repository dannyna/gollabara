<script setup lang="ts">
import { ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import { dayRail, rail, turnRail } from './gallery-samples'
import StreamRail from './StreamRail.vue'

const selected = ref<string | null>(null)
</script>

<template>
  <GalleryCase title="같은 세션 연속 · 세션 전환 · piuda → od에서 점선, od 두 장 사이는 22, od → client-e2e에서 다시 점선">
    <div class="frame" style="--h: 340px">
      <StreamRail bare :artifacts="rail(['sidebar', 'hero-a', 'hero-b', 'checkout-1', 'checkout-2'])" :selected="selected" @select="selected = $event" />
    </div>
  </GalleryCase>
  <GalleryCase title="음소거한 세션 · 셀이 빠지고 자리도 남기지 않음 · 순번은 그대로 (전 → od 음소거 후)">
    <div class="frame split" style="--h: 600px">
      <p class="lbl mono">
        음소거 전
      </p>
      <StreamRail bare :artifacts="rail(['sidebar', 'hero-a', 'checkout-1'])" />
      <p class="lbl mono">
        od 음소거 후
      </p>
      <StreamRail bare :artifacts="rail(['sidebar', 'checkout-1'])" />
    </div>
  </GalleryCase>
  <GalleryCase title="음소거로 이웃이 붙음 · 구분은 보이는 셀끼리 계산">
    <div class="frame split" style="--h: 520px">
      <p class="lbl mono">
        piuda · od · piuda
      </p>
      <StreamRail bare :artifacts="rail(['sidebar', 'hero-c', 'settings'])" />
      <p class="lbl mono">
        od 음소거 후 · 구분선 없음
      </p>
      <StreamRail bare :artifacts="rail(['sidebar', 'settings'])" />
    </div>
  </GalleryCase>
  <GalleryCase title="한 턴의 여러 장 · 이름이 없으면 ‘n장째’ · 묶음 상자 없이 이웃한 셀">
    <div class="frame" style="--h: 340px">
      <StreamRail bare :artifacts="turnRail()" />
    </div>
  </GalleryCase>
  <GalleryCase title="날짜 바뀜 · 같은 세션이어도 구분선, 메타 시각 앞에 날짜(fg mono)">
    <div class="frame" style="--h: 340px">
      <StreamRail bare :artifacts="dayRail()" />
    </div>
  </GalleryCase>
</template>

<style scoped>
.frame {
  height: var(--h);
  margin: 0 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 20px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.split > .rail + .lbl {
  border-top: 1px solid var(--border);
}
.lbl {
  padding: 14px 22px 0;
  color: var(--muted);
  font-size: 10px;
}
@media (max-width: 767px) {
  .frame {
    margin: 0 12px;
  }
}
</style>
