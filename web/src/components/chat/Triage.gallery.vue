<script setup lang="ts">
import type { StreamMessage, Triage } from '../../../../src/shared/types'
import { computed, onBeforeUnmount, ref } from 'vue'
import ChatFrame from '../../gallery/ChatFrame.vue'
import { S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import { HOLD_MS, toTriageMap, triageKey, triageView } from '../../triage'
import HiddenToggle from './HiddenToggle.vue'
import SessionMessage from './SessionMessage.vue'

function turn(id: number, name: string, at: number, text: string): StreamMessage {
  return { id, at, sessionId: name, sessionName: name, kind: 'turn', recaps: [text], text }
}

// Interleaved sessions: piuda, e2e, piuda, e2e
const feed = [
  turn(1, S.piuda, time(14, 31), '1/10 경과, 서버 정상.'),
  turn(2, S.e2e, time(14, 32), '앱 실행 e2e 3건 통과, 로그인 화면 정상 렌더 확인'),
  turn(3, S.piuda, time(14, 36), '5분 경과, 피드백 없음. 계속 대기합니다.'),
  turn(4, S.e2e, time(14, 38), '결제 e2e 2건 실패: 카드 입력 후 확인 버튼이 비활성으로 남음'),
]
const verdicts: Triage[] = [
  { messageId: 1, index: 0, verdict: 'hide' },
  { messageId: 2, index: 0, verdict: 'show' },
  { messageId: 3, index: 0, verdict: 'hide' },
  { messageId: 4, index: 0, verdict: 'show' },
]
const showHidden = ref(false)
const view = computed(() => triageView(feed, { engine: 'claude', triage: toTriageMap(verdicts), now: Date.now(), showHidden: showHidden.value }))

// Pending hold, live: a recap-only line waits up to HOLD_MS (10 s) for its verdict
const arrivedAt = ref<number | null>(null)
const late = ref<Triage | null>(null)
const now = ref(Date.now())
const held = turn(9, S.piuda, time(14, 40), '6분 경과, 피드백 없음.')
const holdView = computed(() => arrivedAt.value == null
  ? null
  : triageView([held], { engine: 'claude', triage: toTriageMap(late.value ? [late.value] : []), arrivals: new Map([[triageKey(9, 0), arrivedAt.value]]), now: now.value }))
let timers: ReturnType<typeof setTimeout>[] = []
function arrive(verdictAfter: number | null) {
  timers.forEach(clearTimeout)
  arrivedAt.value = now.value = Date.now()
  late.value = null
  timers = [setTimeout(() => now.value = Date.now(), HOLD_MS + 20)]
  if (verdictAfter != null)
    timers.push(setTimeout(() => late.value = { messageId: 9, index: 0, verdict: 'hide' }, verdictAfter))
}
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <GalleryCase title="01 · 숨긴 메시지 토글 (세션이 섞여도 메시지마다 판정)">
    <ChatFrame note="piuda · e2e · piuda · e2e 순서. 숨김 판정 두 줄은 빠지고 머리의 「숨긴 메시지 2」가 켜면 그 자리에 흐리게 보인다.">
      <div class="heading">
        <b>세션 대화</b>
        <HiddenToggle v-model="showHidden" :count="view.hidden" />
      </div>
      <SessionMessage v-for="item in view.items" :key="item.message.id" :name="item.message.sessionName" :at="item.message.at" :class="{ dim: item.dim }">
        <p v-for="line in item.lines" :key="line.index">
          {{ line.text }}
        </p>
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 판정 대기 (새 리캡만, 최대 10초)">
    <ChatFrame note="이미지 없는 새 리캡은 판정을 10초까지 기다린다. 그 안에 숨김 판정이 오면 한 번도 그리지 않고, 판정이 없으면 10초 뒤 그대로 보인다. 더 늦게 숨김 판정이 오면 조용히 빠진다. 질문과 이미지 있는 턴, 엔진이 꺼진 상태는 기다리지 않는다.">
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
      <p v-if="!holdView" class="muted state">
        버튼을 눌러 보세요.
      </p>
      <p v-else-if="!holdView.items.length && holdView.nextCheck" class="muted state">
        판정 기다리는 중 · 아직 그리지 않음
      </p>
      <p v-else-if="!holdView.items.length" class="muted state">
        숨김으로 판정돼 조용히 빠짐
      </p>
      <SessionMessage v-for="item in holdView?.items" :key="item.message.id" :name="item.message.sessionName" :at="item.message.at">
        {{ item.lines[0]?.text }}
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
</template>

<style scoped>
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 500;
}
.dim {
  opacity: 0.5;
}
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
