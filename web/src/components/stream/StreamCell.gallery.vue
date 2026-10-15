<script setup lang="ts">
import { ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import { feedbackTargetOf, useFeedbackTarget } from '../overlay/useFeedbackTarget'
import { documentSample, one, rail } from './gallery-samples'
import StreamCell from './StreamCell.vue'

const ratios = rail(['hero-b', 'settings', 'checkout-1', 'icons', 'checkout-full', 'banner'])
const portrait = rail(['checkout-1', 'checkout-2'])
const docs = [
  { ...one('hero-b'), runStart: true },
  { ...documentSample('html', 'od', 11, 14, '시안 HTML · 예시'), runStart: false },
  { ...documentSample('doc', 'piuda', 12, 16, '문서 · 예시'), runStart: true },
]

const { target, setTarget } = useFeedbackTarget()
const picked = ref<string | null>('hero-b')
const tryCell = one('hero-b')
</script>

<template>
  <GalleryCase title="해부 · hover · ① 메타 48 ② 이미지 면(비율로 너비) ③ 캡션 37 ④ 액션(바닥 49 · 오른쪽 9)">
    <div class="solo" style="--h: 340px">
      <StreamCell :artifact="one('hero-b')" preview="hover" />
    </div>
  </GalleryCase>
  <GalleryCase title="기본 · 투명 테두리 2가 자리를 잡아 둠">
    <div class="solo">
      <StreamCell :artifact="one('hero-a')" />
    </div>
  </GalleryCase>
  <GalleryCase title="hover · muted 테두리 + 액션">
    <div class="solo">
      <StreamCell :artifact="one('hero-a')" preview="hover" />
    </div>
  </GalleryCase>
  <GalleryCase title="키보드 포커스 · fg 2px 링, 간격 3 · 액션도 보임">
    <div class="solo">
      <StreamCell :artifact="one('hero-a')" preview="focus" />
    </div>
  </GalleryCase>
  <GalleryCase title="선택 · accent 2px, 한 번에 한 칸">
    <div class="solo">
      <StreamCell :artifact="one('hero-b')" selected />
    </div>
  </GalleryCase>
  <GalleryCase title="고정 · 선택 테두리 + 왼쪽 위 핀 배지(ink 원, 흰 2px 테두리) + 캡션 순번 앞 핀">
    <div class="solo">
      <StreamCell :artifact="one('hero-b')" selected pinned />
    </div>
  </GalleryCase>
  <GalleryCase title="선택 + 포커스 · accent 바깥에 fg 링">
    <div class="solo">
      <StreamCell :artifact="one('hero-b')" selected preview="focus" />
    </div>
  </GalleryCase>
  <GalleryCase title="키보드 · 답장에 포커스 · 링은 층 안쪽(간격 −2)">
    <div class="solo">
      <StreamCell :artifact="one('hero-b')" preview="focus-reply" />
    </div>
  </GalleryCase>
  <GalleryCase title="좁은 세로 셀 · 액션 층을 캡션 줄로 내림">
    <div class="solo" style="--h: 440px">
      <StreamCell :artifact="portrait[0]!" />
      <StreamCell :artifact="portrait[1]!" preview="hover" />
    </div>
  </GalleryCase>
  <GalleryCase title="터치 · 선택한 셀은 액션을 늘 보임 (pointer: coarse)">
    <div class="solo">
      <StreamCell :artifact="one('hero-b')" selected preview="hover" />
    </div>
  </GalleryCase>
  <GalleryCase title="불러오는 중 · 원본 비율로 칸을 먼저 잡음">
    <div class="solo">
      <StreamCell :artifact="one('hero-c')" face="loading" />
    </div>
  </GalleryCase>
  <GalleryCase title="불러오지 못함 · fg, 빨강 없음, 선택 · 답장은 그대로">
    <div class="solo">
      <StreamCell :artifact="one('hero-c')" face="failed" />
    </div>
  </GalleryCase>
  <GalleryCase title="비율 · 가로 · 긴 페이지 · 세로 폰 · 정사각 · 아주 긴 세로(최소 120) · 아주 넓은 가로(최대 레일 폭)">
    <div class="solo" style="--h: 400px">
      <StreamCell v-for="a in ratios" :key="a.key" :artifact="a" />
    </div>
  </GalleryCase>
  <GalleryCase title="답장 · 이 이미지를 피드백 대상으로 (보내지 않음)">
    <div class="solo">
      <StreamCell
        :artifact="tryCell" :selected="picked === tryCell.key"
        @select="picked = picked === tryCell.key ? null : tryCell.key" @reply="setTarget(feedbackTargetOf(tryCell))"
      />
    </div>
    <p class="readout mono">
      피드백 대상: {{ target ? `${target.sessionId} · ${target.caption}` : '없음' }}
    </p>
  </GalleryCase>
  <GalleryCase title="예정 · 이미지가 아닌 산출물 · 16:10 면, 크기 대신 유형, 확대 대신 열기 ↗">
    <div class="solo" style="--h: 380px">
      <StreamCell :artifact="docs[0]!" />
      <StreamCell :artifact="docs[1]!" size-label="HTML" view-text="열기 ↗" selected>
        <template #face>
          <span class="doc-face">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" /></svg>
            <strong>히어로 시안</strong><span>landing-hero/index.html</span>
          </span>
        </template>
      </StreamCell>
      <StreamCell :artifact="docs[2]!" size-label="문서" view-text="열기 ↗" preview="hover">
        <template #face>
          <span class="doc-face">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>
            <strong>설계 메모</strong><span>docs/notes.md</span>
          </span>
        </template>
      </StreamCell>
    </div>
  </GalleryCase>
</template>

<style scoped>
/* A rail row with no heading or footer: the face is the height minus meta 48 + caption 37 */
.solo {
  height: var(--h, 300px);
  margin: 0 18px;
  display: flex;
  gap: 22px;
  padding: 14px 22px 12px;
  overflow-x: auto;
  overflow-y: hidden;
  container-type: size;
  --stream-chrome: 85px;
  --stream-inset: 0px;
  border-radius: 20px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.readout {
  padding: 10px 18px 0;
  color: var(--muted);
}
.doc-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
  padding: 16px;
  text-align: left;
  border-radius: 10px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.doc-face .icon {
  width: 22px;
  height: 22px;
  margin-bottom: auto;
  color: var(--muted);
}
.doc-face strong {
  font-size: 13px;
  font-weight: 600;
}
.doc-face span {
  font: 10px var(--mono);
  color: var(--muted);
  overflow-wrap: anywhere;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .solo {
    --stream-chrome: 59px;
  }
}
@media (max-width: 767px) {
  .solo {
    margin: 0 12px;
  }
}
</style>
