<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { E2E_MULTI, HERO_ROWS, HERO_SHORT, S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import QuestionCard from './QuestionCard.vue'
import SessionMessage from './SessionMessage.vue'

const ASK = '시안 3개 올렸어. 하나 골라 줘.'
</script>

<template>
  <GalleryCase title="01 · 응답 대기 · 짧은 선택지">
    <ChatFrame note="설명 없는 짧은 라벨 3개 이하는 가로 버튼. 누르면 바로 보낸다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_SHORT" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 응답 대기 · 설명 있는 선택지">
    <ChatFrame note="설명이 있으면 세로 행. 라벨은 굵게, 설명은 muted.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 여러 개 고르기">
    <ChatFrame note="multiSelect면 체크 행 + 카드 안 주 버튼 하나. 아무것도 안 골랐으면 버튼을 끈다.">
      <SessionMessage :name="S.e2e" :at="time(14, 37)">
        e2e 시나리오를 나눠 돌릴게.<QuestionCard :question="E2E_MULTI" :picks="[0, 1]" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 질문이 여러 개">
    <ChatFrame note="한 장씩 넘긴다. 마지막 문항에 답할 때 한꺼번에 보낸다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" count="1 / 2" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="05 · 직접 입력">
    <ChatFrame note="‘직접 답하기’를 누르면 선택지 자리가 입력 미리보기로 바뀐다. 입력은 아래 컴포저에서.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="typed" typed="B로 가되, 카피는 한 줄로 줄여 줘" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="06 · 보내는 중">
    <ChatFrame note="고른 항목만 fg, 나머지는 잠그고 muted.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="sending" :picks="[1]" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="07 · 전달됨">
    <ChatFrame note="완료 줄에 고른 답과 시각. 체크 아이콘은 fg.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="done" :picks="[1]" :answered-at="time(14, 36)" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="08 · 터미널에서 먼저 답함">
    <ChatFrame note="터미널 응답이 확인되면 앱 선택지를 닫아 중복 응답을 막는다. 고른 답을 알 수 있으면 표시.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="terminal" :picks="[0]" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="09 · 전달 못 함">
    <ChatFrame note="빨강 없이 경고 아이콘 + fg 글자. 선택지는 다시 열어 둔다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="fail" :picks="[1]" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="10 · 연결 끊김">
    <ChatFrame note="질문은 계속 읽을 수 있고 선택지만 잠근다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        {{ ASK }}<QuestionCard :question="HERO_ROWS" state="offline" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="app · 답하기 준비 중 (inert)">
    <ChatFrame note="지금 앱이 그리는 상태. 질문과 선택지는 그대로 읽히고, 모든 버튼은 꺼져 있다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        <QuestionCard :question="HERO_ROWS" count="1 / 2" inert />
        <QuestionCard :question="E2E_MULTI" count="2 / 2" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
</template>
