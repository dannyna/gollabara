<script setup lang="ts">
import { ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import FloatingActions from './FloatingActions.vue'
import { SAMPLE_ARTIFACTS } from './gallery-samples'

const hero = SAMPLE_ARTIFACTS[2]!
const viewed = ref(0)
const replied = ref(0)
</script>

<template>
  <GalleryCase title="산출물 셀 · 답장(피드백 대상으로) · 확대 ↗">
    <GalleryStage :height="280">
      <div class="cell">
        <span class="hit"><img :src="hero.url" alt="히어로 B 회색조 와이어 목업"></span>
        <div class="cap mono">
          od · 14:34
        </div>
        <FloatingActions view-label="히어로 B 크게 보기" reply reply-label="히어로 B에 답장" shown />
      </div>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="세션 메시지 · 머리줄 위로 · 767px 이하에서는 숨김">
    <GalleryStage :height="170">
      <article class="message">
        <div class="head">
          <span class="avatar" aria-hidden="true">o</span>
          <strong>od <span class="muted">· landing-hero</span></strong>
          <time>14:34</time>
        </div>
        <div class="body">
          히어로 시안 세 장 올렸어.
        </div>
        <FloatingActions variant="message" reply reply-label="od 메시지에 답장" shown />
      </article>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="세션 메시지 · 끝난 세션 (답장 꺼짐)">
    <GalleryStage :height="170">
      <article class="message">
        <div class="head">
          <span class="avatar" aria-hidden="true">o</span>
          <strong>od <span class="muted">· landing-hero</span></strong>
          <time>14:34</time>
        </div>
        <div class="body">
          히어로 시안 세 장 올렸어.
        </div>
        <FloatingActions variant="message" reply-label="od 메시지에 답장" shown />
      </article>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="hover · 키보드 포커스로 나타남">
    <GalleryStage :height="280">
      <div class="cell" data-floating-host>
        <button class="hit" type="button" aria-label="히어로 B 선택">
          <img :src="hero.url" alt="">
        </button>
        <div class="cap mono">
          답장 {{ replied }}번 · 확대 ↗ {{ viewed }}번
        </div>
        <FloatingActions view-label="히어로 B 크게 보기" reply @reply="replied++" @view="viewed++" />
      </div>
    </GalleryStage>
  </GalleryCase>
</template>

<style scoped>
.cell {
  position: absolute;
  left: 24px;
  top: 24px;
  width: min(300px, calc(100% - 48px));
}
.hit {
  display: block;
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 2px solid var(--accent);
  border-radius: 12px;
  box-shadow: 0 10px 24px oklch(0 0 0 / 0.2);
}
.hit img {
  display: block;
  width: 100%;
}
.cell .floating-actions {
  bottom: auto;
  top: calc(100% - 52px);
}
.cap {
  margin-top: 8px;
  color: var(--muted);
  font-size: 10px;
}
.message {
  position: absolute;
  left: 22px;
  right: 22px;
  top: 56px;
  border-radius: 9px;
  background: var(--bg);
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
  font-size: 11px;
}
.avatar {
  width: 23px;
  height: 23px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--surface);
  font: 600 11px var(--display);
}
.head time {
  margin-left: auto;
  color: var(--muted);
  font-size: 9px;
}
.body {
  padding-left: 31px;
  font-size: 12px;
  line-height: 1.8;
}
</style>
