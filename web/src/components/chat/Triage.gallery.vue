<script setup lang="ts">
import type { StreamMessage, Triage } from '../../../../src/shared/types'
import { computed, onBeforeUnmount, ref } from 'vue'
import ChatFrame from '../../gallery/ChatFrame.vue'
import { HERO_SHORT, S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import { HOLD_MS, toTriageMap, triageKey, triageView } from '../../triage'
import AdviceLine from './AdviceLine.vue'
import ChatComposer from './ChatComposer.vue'
import HiddenToggle from './HiddenToggle.vue'
import QuestionCard from './QuestionCard.vue'
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
  { messageId: 1, index: 0, verdict: 'noise' },
  { messageId: 2, index: 0, verdict: 'progress' },
  { messageId: 3, index: 0, verdict: 'noise' },
  { messageId: 4, index: 0, verdict: 'signal', advice: '버튼 활성 조건부터 확인하게 하세요.', draft: '실패한 2건 로그 보여 주고, 확인 버튼 활성 조건부터 고쳐 줘' },
]
const showHidden = ref(false)
const view = computed(() => triageView(feed, { engine: 'claude', triage: toTriageMap(verdicts), now: Date.now(), showHidden: showHidden.value }))

// The draft chip fills the composer and focuses it; nothing is sent
const composer = ref<InstanceType<typeof ChatComposer>>()

// Pending hold, live: a recap-only line waits up to 3 s for its verdict
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
    timers.push(setTimeout(() => late.value = { messageId: 9, index: 0, verdict: 'noise' }, verdictAfter))
}
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <GalleryCase title="01 · 조언 (signal 아래 muted 한 줄)">
    <ChatFrame note="조언은 메시지 아래 muted 11px. 아이콘도 muted, 노란색 없음. 사용자에게만 보이고 세션에는 가지 않는다.">
      <SessionMessage :name="S.e2e" :at="time(14, 38)">
        <p>결제 e2e 2건 실패: 카드 입력 후 확인 버튼이 비활성으로 남음</p>
        <AdviceLine advice="버튼 활성 조건부터 확인하게 하세요." />
      </SessionMessage>
      <SessionMessage :name="S.od" :at="time(14, 39)">
        <QuestionCard :question="HERO_SHORT" inert />
        <AdviceLine advice="세션 추천이 B예요. 하단 여백만 같이 물어보세요." draft="B로 가자. 하단 여백만 줄여 줘" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 초안 칩 (누르면 입력창만 채움)">
    <ChatFrame note="칩은 surface 면에 border 선. 누르면 그 세션을 받는 사람으로 입력창을 채우고 포커스만 옮긴다. 자동으로 보내지 않는다.">
      <SessionMessage :name="S.e2e" :at="time(14, 38)">
        <p>결제 e2e 2건 실패: 카드 입력 후 확인 버튼이 비활성으로 남음</p>
        <AdviceLine
          advice="버튼 활성 조건부터 확인하게 하세요." draft="실패한 2건 로그 보여 주고, 확인 버튼 활성 조건부터 고쳐 줘"
          @draft="composer?.fill($event)"
        />
      </SessionMessage>
      <template #footer>
        <ChatComposer ref="composer" can-send target="client-e2e" />
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 숨긴 메시지 토글 (세션이 섞여도 메시지마다 판정)">
    <ChatFrame note="piuda · e2e · piuda · e2e 순서. 잡담 두 줄은 빠지고 머리의 「숨긴 메시지 2」가 켜면 그 자리에 흐리게 보인다.">
      <div class="heading">
        <b>세션 대화</b>
        <HiddenToggle v-model="showHidden" :count="view.hidden" />
      </div>
      <SessionMessage v-for="item in view.items" :key="item.message.id" :name="item.message.sessionName" :at="item.message.at" :class="{ dim: item.dim }">
        <template v-for="line in item.lines" :key="line.index">
          <p>{{ line.text }}</p>
          <AdviceLine :advice="line.advice" :draft="line.draft" />
        </template>
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 판정 대기 (새 리캡만, 최대 3초)">
    <ChatFrame note="이미지 없는 새 리캡은 판정을 3초까지 기다린다. 판정이 없으면 그대로 보이고, 늦게 잡담 판정이 오면 조용히 빠진다. 엔진이 꺼져 있으면 기다리지 않는다.">
      <div class="controls">
        <button type="button" class="text-button" @click="arrive(null)">
          새 리캡 · 판정 없음
        </button>
        <button type="button" class="text-button" @click="arrive(5000)">
          새 리캡 · 5초 뒤 잡담 판정
        </button>
      </div>
      <p v-if="!holdView" class="muted state">
        버튼을 눌러 보세요.
      </p>
      <p v-else-if="!holdView.items.length && holdView.nextCheck" class="muted state">
        판정 기다리는 중 · 아직 그리지 않음
      </p>
      <p v-else-if="!holdView.items.length" class="muted state">
        잡담으로 판정돼 조용히 빠짐
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
