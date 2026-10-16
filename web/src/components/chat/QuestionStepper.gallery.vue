<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { ENDED_SET, HERO_ROWS, S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import QuestionStepper from './QuestionStepper.vue'
import SessionMessage from './SessionMessage.vue'

const ASK = '끝난 세션을 어떻게 보일지 정해 줘.'
const NAME = 'gollabara · ended-sessions'
// A fixed clock, so the countdown reads the same in every capture
const NOW = time(14, 35)
const UNTIL = NOW + 41_000
</script>

<template>
  <GalleryCase title="01 · 읽기 전용 · 첫 질문 (모바일은 390 너비로 확인)">
    <ChatFrame note="한 카드에 질문 묶음 전체. 지금 질문이 카드를 채우고, 카드 맨 아래 인디케이터 ‹ ● ○ ○ ›로 넘긴다. 「준비 중」 안내는 없다. 점마다 그 질문으로 가는 버튼이다. 붙잡히지 않은 질문이라 선택지는 번호가 붙은 읽기 전용 줄. 첫 질문이라 ‹는 흐리고 눌리지 않는다.">
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
    <ChatFrame note="header와 고른 답만 muted로 남긴다. 라벨이 아닌 답은 그 글 그대로. 고른 답을 모르는 질문은 「터미널에서 답했어요」.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" state="terminal" :picks="[[0], [], []]" :texts="[undefined, '지난 메시지는 그대로 두고 흐리게만', undefined]" />
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
  <GalleryCase title="07 · 답할 수 있음 · 첫 질문">
    <ChatFrame note="세션의 훅이 붙잡은 동안 각 페이지의 선택지가 버튼이 된다. 하나 고르기는 누르면 기록하고 다음 질문으로 넘어간다. 남은 시간은 muted 한 줄.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="08 · 답할 수 있음 · 직접 답하기">
    <ChatFrame note="질문마다 「직접 답하기」로 글을 적는다. 입력란은 선택지와 같은 칸에 겹쳐서 카드 높이가 그대로다. 답한 질문의 점은 채워진다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" :start="1" :picks="[[0]]" :texts="[undefined, '지난 메시지는 그대로 두고 흐리게만']" :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="09 · 답할 수 있음 · 마지막 질문">
    <ChatFrame note="마지막 페이지에 주 버튼 「n개 답 보내기」. 모든 질문에 답이 있어야 켜지고, 한 번에 보낸다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" :start="2" :picks="[[0], [1], [0]]" :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="10 · 보내는 중">
    <ChatFrame note="보낸 답을 요약으로 접고 스피너 한 줄.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" state="sending" :picks="[[0], [1], [0]]" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="11 · 앱에서 모두 답함">
    <ChatFrame note="「앱에서 모두 답했어요 · 시각」, 그 아래 header와 답.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" state="done" :picks="[[0], [], [0]]" :texts="[undefined, '지난 메시지는 그대로 두고 흐리게만', undefined]" :answered-at="time(14, 36)" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="12 · 시간이 지남">
    <ChatFrame note="보냈을 때 붙잡기가 이미 끝났으면 (409) 선택지를 잠그고 「시간이 지나 터미널로 넘어갔어요」.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" state="fail" failure="closed" :picks="[[0], [1], [0]]" :start="2" inert />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="13 · 전달 못 함 · 다시 보내기">
    <ChatFrame note="네트워크 오류. 아직 붙잡혀 있으면 고른 답을 그대로 두고 다시 보내기를 연다.">
      <SessionMessage :name="NAME" :at="time(14, 35)">
        {{ ASK }}<QuestionStepper :questions="ENDED_SET" state="fail" :picks="[[0], [1], [0]]" :start="2" retry :until="UNTIL" :now="NOW" />
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
</template>
