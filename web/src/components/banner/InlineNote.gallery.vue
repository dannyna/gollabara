<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import InlineNote from './InlineNote.vue'
</script>

<template>
  <GalleryCase title="panel headings · muted hints">
    <div class="stack">
      <div class="row">
        <strong>산출물 스트림</strong><InlineNote>산출물을 선택해 피드백을 남겨요</InlineNote>
      </div>
      <div class="row">
        <strong>세션 대화</strong><InlineNote>질문에 답하고, 피드백을 남겨요</InlineNote>
      </div>
    </div>
  </GalleryCase>
  <GalleryCase title="stream footer · following / paused">
    <div class="stack footer">
      <div class="row">
        <InlineNote>이미지는 원래 비율 그대로</InlineNote><InlineNote class="mono">
          최신 산출물 · 따라가는 중
        </InlineNote>
      </div>
      <div class="row">
        <InlineNote>이미지는 원래 비율 그대로</InlineNote><InlineNote class="mono">
          이전 산출물 · 자동 따라가기 일시 정지
        </InlineNote>
      </div>
    </div>
  </GalleryCase>
  <GalleryCase title="question card · 터미널에서 답함 (choices locked)">
    <div class="question">
      <p class="eyebrow">
        히어로 방향
      </p>
      <p>히어로 시안 3안 중 어느 쪽으로 갈까요?</p>
      <div class="choices">
        <button v-for="c in ['A', 'B', 'C']" :key="c" type="button" disabled>
          {{ c }}
        </button>
      </div>
      <p class="locked">
        <InlineNote>터미널에서 답함</InlineNote>
      </p>
    </div>
  </GalleryCase>
  <GalleryCase title="composer note · usual / offline / no target">
    <div class="stack composer">
      <div class="row">
        <InlineNote>@세션을 부르거나, 산출물에 답장해 보세요</InlineNote><span>보내기는 준비 중이에요</span>
      </div>
      <div class="row">
        <InlineNote tone="blocked" icon="plug">
          다시 연결되면 보낼 수 있어요
        </InlineNote><span>보내기는 준비 중이에요</span>
      </div>
      <div class="row">
        <InlineNote tone="blocked" icon="alert">
          @로 보낼 세션을 골라 주세요
        </InlineNote><span>보내기는 준비 중이에요</span>
      </div>
    </div>
  </GalleryCase>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 560px;
  padding: 0 18px;
  font-size: 11px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.row strong {
  font-size: 12px;
  font-weight: 600;
}
.footer,
.footer .mono {
  font-size: 10px;
}
.composer {
  max-width: 400px;
  font-size: 9px;
  color: var(--muted);
}
.question {
  max-width: 400px;
  margin: 0 18px;
  padding: 16px;
  border-radius: 16px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
  font-size: 12px;
  line-height: 1.7;
}
.eyebrow {
  margin-bottom: 7px;
  font-size: 10px;
  font-weight: 600;
}
.choices {
  display: flex;
  gap: 6px;
  margin-top: 11px;
}
.choices button {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  font: 500 12px var(--mono);
}
.locked {
  padding-top: 10px;
  font-size: 11px;
}
</style>
