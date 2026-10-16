<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { ENDED_SET, HERO_ROWS, S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import QuestionStepper from './QuestionStepper.vue'
import SessionMessage from './SessionMessage.vue'

const ASK = '끝난 세션을 어떻게 보일지 정해 줘.'
const NAME = 'gollabara · ended-sessions'
</script>

<template>
  <GalleryCase title="01 · 첫 질문 · 답하기 준비 중 (모바일은 390 너비로 확인)">
    <ChatFrame note="한 카드에 질문 묶음 전체. 단계를 누르거나 이전 / 다음으로 넘긴다. 첫 질문에서는 이전이 꺼진다. 선택지는 꺼져 있어도 넘기기는 된다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 중간 질문">
    <ChatFrame note="앞뒤로 모두 넘길 수 있다. 카드는 가장 긴 질문의 높이를 지켜서, 넘겨도 아래 대화가 움직이지 않는다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" :start="1" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 마지막 질문">
    <ChatFrame note="마지막에서는 다음이 꺼진다. 짧은 가로 선택지여도 높이는 그대로.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" :start="2" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 터미널에서 모두 답함">
    <ChatFrame note="header와 고른 답만 muted로 남긴다. 고른 답을 모르는 질문은 「터미널에서 답했어요」.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" state="terminal" :picks="[[0], [1], [0]]" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="05 · 연결 끊김">
    <ChatFrame note="선택지만 잠그고, 넘기기는 그대로 된다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" state="offline" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="06 · 질문이 하나 · 지금 카드 그대로">
    <ChatFrame note="질문이 하나면 단계도 이전 / 다음도 없다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        <QuestionStepper :questions="[HERO_ROWS]" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
</template>
