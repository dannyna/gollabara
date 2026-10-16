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
  <GalleryCase title="01 · 첫 질문 (모바일은 390 너비로 확인)">
    <ChatFrame note="한 카드에 질문 묶음 전체. 지금 질문이 카드를 채우고, 카드 맨 아래 인디케이터 ‹ ● ○ ○ ›로 넘긴다. 「준비 중」 안내는 없다. 점마다 그 질문으로 가는 버튼이다. 선택지는 번호가 붙은 읽기 전용 줄. 첫 질문이라 ‹는 흐리고 눌리지 않는다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 중간 질문">
    <ChatFrame note="‹로 되짚고 ›로 넘긴다. 지금 질문의 점만 길게 채워진다. 카드는 가장 긴 질문의 높이를 지켜서, 넘겨도 아래 대화가 움직이지 않는다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" :start="1" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 마지막 질문">
    <ChatFrame note="마지막 질문이라 ›는 흐리고 눌리지 않는다. 화살표가 자리를 지켜서 인디케이터가 움직이지 않는다.">
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
    <ChatFrame note="선택지는 원래 읽기 전용이라 그대로, 넘기기도 그대로 된다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" state="offline" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="06 · 질문이 하나 · 지금 카드 그대로">
    <ChatFrame note="질문이 하나면 인디케이터가 없다.">
      <SessionMessage :name="S.od" :at="time(14, 35)">
        <QuestionStepper :questions="[HERO_ROWS]" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
</template>
