<script setup lang="ts">
import type { HistoryDay } from '../../../../src/shared/types'
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import ChatIcon from '../chat/ChatIcon.vue'
import DayPopover from './DayPopover.vue'

function noop() {}

// Labels count back from this moment, so the case reads the same every day
const NOW = new Date(2026, 9, 14, 14, 30).getTime()
const day = (back: number) => new Date(2026, 9, 14 - back).getTime()
const DAYS: HistoryDay[] = [
  { start: day(0), count: 42 },
  { start: day(1), count: 118 },
  { start: day(3), count: 7 },
  { start: day(9), count: 64 },
  { start: day(16), count: 3 },
  { start: day(30), count: 21 },
]
</script>

<template>
  <GalleryCase title="날짜 목록 · 기록이 있는 날만, 최근부터 (≤767px에서는 바텀시트)">
    <GalleryStage :height="520">
      <div class="heading">
        <h2>세션 대화</h2>
        <div class="end">
          <span>질문에 답하고, 피드백을 남겨요</span>
          <div class="anchor">
            <button class="days-button" type="button" aria-expanded="true">
              <ChatIcon name="calendar" />날짜
            </button>
            <DayPopover :days="DAYS" :now="NOW" preview @close="noop" />
          </div>
        </div>
      </div>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="한 세션만 보는 중 · 그 세션의 날짜만">
    <GalleryStage :height="360">
      <div class="heading">
        <h2>세션 대화</h2>
        <div class="end">
          <div class="anchor">
            <button class="days-button" type="button" aria-expanded="true">
              <ChatIcon name="calendar" />날짜
            </button>
            <DayPopover :days="DAYS.slice(1, 3)" :now="NOW" scoped preview @close="noop" />
          </div>
        </div>
      </div>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="불러오는 중">
    <GalleryStage :height="220">
      <div class="heading bare">
        <div class="end">
          <div class="anchor">
            <DayPopover :days="null" preview @close="noop" />
          </div>
        </div>
      </div>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="기록 없음">
    <GalleryStage :height="220">
      <div class="heading bare">
        <div class="end">
          <div class="anchor">
            <DayPopover :days="[]" preview @close="noop" />
          </div>
        </div>
      </div>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="불러오지 못함">
    <GalleryStage :height="220">
      <div class="heading bare">
        <div class="end">
          <div class="anchor">
            <DayPopover :days="null" error preview @close="noop" />
          </div>
        </div>
      </div>
    </GalleryStage>
  </GalleryCase>
</template>

<style scoped>
.heading {
  position: relative;
  max-width: 440px;
  margin: 24px 0 0 auto;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 24px;
  border-radius: 24px 24px 0 0;
  background: var(--surface);
}
.heading h2 {
  font-size: 13px;
  font-weight: 500;
}
.end {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  color: var(--muted);
}
.anchor {
  position: relative;
}
.days-button {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  margin-right: -7px;
  padding: 0 9px 0 7px;
  border-radius: 8px;
  background: var(--bg);
  color: var(--fg);
  font-size: 11px;
}
.days-button :deep(.chat-icon) {
  width: 15px;
  height: 15px;
}
.bare {
  height: 0;
  background: none;
}
</style>
