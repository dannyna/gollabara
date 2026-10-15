<script setup lang="ts">
import type { Triage } from '../../../../src/shared/types'
import { computed, onBeforeUnmount, ref } from 'vue'
import ChatFrame from '../../gallery/ChatFrame.vue'
import FeedPreview from '../../gallery/FeedPreview.vue'
import { hide, S, show, time, turn } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import { HOLD_MS, shownKeys, toTriageMap, triageKey, triageView } from '../../triage'

// Hidden lines from the OD guide message-state-components.html §02: no heading toggle, a
// folded row wherever lines dropped out

// piuda · od · piuda in a row are hidden: one row across two sessions
const feed = [
  turn(1, S.piuda, time(14, 32), '사이드바 접힘 상태 저장 구현 끝. 테스트 12개 통과.'),
  turn(2, S.piuda, time(14, 33), '테스트 다시 돌리는 중…'),
  turn(3, S.od, time(14, 33), '빌드 기다리는 중.'),
  turn(4, S.piuda, time(14, 34), '아직 돌아가는 중.'),
  turn(5, S.od, time(14, 36), '히어로 B 기준으로 하단 여백 정리 끝.'),
]
const verdicts = [show(1, 'success'), hide(2), hide(3), hide(4), show(5)]

// A multi-line turn with its middle line hidden, then a line that was on screen when its hide came
const inside = [
  turn(1, S.docs, time(14, 50), ['검색 색인 재생성 스크립트 작성 끝.', '색인 크기 확인 중…', '재생성에 12분 걸려. 배포 전에 돌릴지 정해 줘.']),
  turn(2, S.piuda, time(14, 52), '단축키 연결하는 중…'),
]
const insideVerdicts = [show(1), hide(1, 1), show(1, 'warning', 2), hide(2)]

// Live: a recap-only line waits up to HOLD_MS (10 s) for its verdict
const held = turn(9, S.piuda, time(14, 40), '6분 경과, 피드백 없음.')
const arrivedAt = ref<number | null>(null)
const late = ref<Triage | null>(null)
const now = ref(Date.now())
const seen = new Set<string>()
const holdView = computed(() => {
  if (arrivedAt.value == null)
    return null
  const v = triageView([held], { engine: 'claude', triage: toTriageMap(late.value ? [late.value] : []), arrivals: new Map([[triageKey(9, 0), arrivedAt.value]]), now: now.value, seen })
  shownKeys(v).forEach(key => seen.add(key))
  return v
})
let timers: ReturnType<typeof setTimeout>[] = []
function arrive(verdictAfter: number | null) {
  timers.forEach(clearTimeout)
  seen.clear()
  arrivedAt.value = now.value = Date.now()
  late.value = null
  timers = [setTimeout(() => now.value = Date.now(), HOLD_MS + 20)]
  if (verdictAfter != null)
    timers.push(setTimeout(() => late.value = hide(9), verdictAfter))
}
onBeforeUnmount(() => timers.forEach(clearTimeout))
const holdState = computed(() => {
  const v = holdView.value
  if (!v)
    return '버튼을 눌러 보세요.'
  const item = v.items[0]
  if (!item)
    return '판정 기다리는 중 · 아직 그리지 않음'
  if (item.folded)
    return '보이기 전에 숨김 판정 · 접힌 행으로'
  return item.parts.some(p => p.type === 'line' && p.line.weak) ? '보인 뒤 숨김 판정 · 제자리에서 흐리게' : '판정 없이 10초 · 그대로 보임'
})
</script>

<template>
  <GalleryCase title="01 · 접은 행 (세션이 섞여도 이어지면 한 행)">
    <ChatFrame note="빠진 자리에 높이 28 행 하나: 가린 눈 아이콘, 개수, 펼침 화살표, 오른쪽 끝에 시각 범위. 세 줄이 두 세션에서 왔지만 이어져 있으므로 한 행이다.">
      <FeedPreview :messages="feed" :triage="verdicts" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 펼친 행">
    <ChatFrame note="펼친 줄은 아바타 열 가운데의 가는 선 안에 든다. 글자는 투명도가 아니라 muted 11px. 머리줄 대신 모노 9px로 ‘세션 · 시각’만 붙고, 상태 상자와 썸네일은 그리지 않는다.">
      <FeedPreview :messages="feed" :triage="verdicts" :open="['h-2:0']" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 한 턴 안의 숨긴 줄 · 늦은 판정">
    <ChatFrame note="위: 여러 줄 요약의 가운데 줄만 빠지면 행이 메시지 안에 들어간다. 아래: 이미 보인 줄에 hide가 늦게 오면 빠지지 않고 제자리에서 muted 11px로만 바뀐다. 다시 열면 접힌 행에 합쳐진다.">
      <FeedPreview :messages="inside" :triage="insideVerdicts" :seen="['2:0']" :open="['h-1:1']" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 판정 대기 (새 리캡만, 최대 10초)">
    <ChatFrame note="이미지 없는 새 리캡은 판정을 10초까지 기다린다. 그 안에 숨김 판정이 오면 한 번도 그리지 않고 접힌 행이 된다. 판정이 없으면 10초 뒤 그대로 보이고, 그 뒤에 숨김 판정이 오면 제자리에서 흐려진다.">
      <div class="controls">
        <button type="button" class="text-button" @click="arrive(null)">
          새 리캡 · 판정 없음
        </button>
        <button type="button" class="text-button" @click="arrive(4000)">
          새 리캡 · 4초 뒤 숨김 판정
        </button>
        <button type="button" class="text-button" @click="arrive(12_000)">
          새 리캡 · 12초 뒤 숨김 판정
        </button>
      </div>
      <p class="muted state">
        {{ holdState }}
      </p>
    </ChatFrame>
  </GalleryCase>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.state {
  margin-bottom: 20px;
  font-size: 11px;
}
</style>
