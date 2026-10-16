<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { E2E_MULTI, HERO_ROWS, HERO_SHORT, S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import QuestionCard from './QuestionCard.vue'
import QuestionStepper from './QuestionStepper.vue'
import SessionMessage from './SessionMessage.vue'

const ASK = '시안 3개 올렸어. 하나 골라 줘.'
// A fixed clock, so the countdown reads the same in every capture
const NOW = time(14, 35)
const UNTIL = NOW + 52_000
</script>

<template>
  <GalleryCase title="01 · 답할 수 있음 · 짧은 선택지">
    <ChatFrame note="세션의 훅이 질문을 붙잡은 동안만 답할 수 있다. 설명 없는 짧은 라벨 3개 이하는 가로 버튼. 누르면 바로 보낸다. 남은 시간은 muted 한 줄로 매초 줄어든다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_SHORT" :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 답할 수 있음 · 설명 있는 선택지">
    <ChatFrame note="설명이 있으면 세로 행. 라벨은 굵게, 설명은 muted. 하나를 누르면 그 라벨로 바로 답한다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 여러 개 고르기">
    <ChatFrame note="multiSelect면 체크 행 + 카드 안 주 버튼 하나. 고른 라벨을 「, 」로 이어 보낸다. 아무것도 안 골랐으면 버튼을 끈다.">
      <SessionMessage :name="S.e2e" :at="time(14, 37)">
        e2e 시나리오를 나눠 돌릴게.<QuestionCard :question="E2E_MULTI" :picks="[0, 1]" :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 직접 답하기">
    <ChatFrame note="‘직접 답하기’를 누르면 선택지 자리에 입력란이 열린다. 라벨이 아닌 글도 그대로 답이 된다. 최대 2000자.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="typed" typed="B로 가되, 카피는 한 줄로 줄여 줘" :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="05 · 보내는 중">
    <ChatFrame note="고른 항목만 fg, 나머지는 잠그고 muted. 남은 시간 줄은 사라진다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="sending" :picks="[1]" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="06 · 앱에서 답함">
    <ChatFrame note="완료 줄에 고른 답과 시각. 체크 아이콘은 fg.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="done" :picks="[1]" :answered-at="time(14, 36)" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="07 · 앱에서 직접 답함">
    <ChatFrame note="라벨이 아닌 답은 그 글을 그대로 보여 준다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="done" answer-text="B로 가되, 카피는 한 줄로" :answered-at="time(14, 36)" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="08 · 터미널에서 먼저 답함">
    <ChatFrame note="터미널 응답이 기록되면 앱 선택지를 닫아 중복 응답을 막는다. 고른 답을 알 수 있으면 표시.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="terminal" :picks="[0]" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="09 · 터미널에서 직접 답함">
    <ChatFrame note="터미널에서 라벨이 아닌 글로 답했으면 그 글이 답이다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="terminal" answer-text="둘 다 보여 줘" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="10 · 시간이 지남">
    <ChatFrame note="보냈을 때 붙잡기가 이미 끝났으면 (409) 터미널로 넘어갔다고만 말한다. 다시 보내기는 없다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="fail" failure="closed" :picks="[1]" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="11 · 전달 못 함 · 다시 보내기">
    <ChatFrame note="네트워크 오류. 빨강 없이 경고 아이콘 + fg 글자. 아직 붙잡혀 있으면 다시 보내기와 선택지를 열어 둔다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="fail" :picks="[1]" retry :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="12 · 연결 끊김">
    <ChatFrame note="질문은 계속 읽을 수 있고 선택지만 잠근다. 아직 붙잡혀 있을 때만 「다시 연결되면 답할 수 있어요」.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="offline" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="13 · 읽기 전용 (붙잡지 않음 · Codex · 끝난 세션)">
    <ChatFrame note="설정이 꺼져 있거나, 붙잡기가 끝났거나, Codex나 끝난 세션이면 질문과 선택지는 그대로 읽히고 모든 버튼은 꺼져 있다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        <QuestionStepper :questions="[HERO_ROWS]" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
</template>
