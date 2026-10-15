<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import FeedPreview from '../../gallery/FeedPreview.vue'
import { S, started, time, turn } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import SessionMessage from './SessionMessage.vue'
import SessionStarts from './SessionStarts.vue'

// Session start rows from the OD guide message-state-components.html §03. A start older than
// the oldest loaded message gets no row, so each feed opens with an earlier message.
const earlier = turn(1, S.infra, time(14, 20), '인증서 갱신 끝.')

const together = [
  earlier,
  turn(2, S.starwrite, time(14, 31), '축소 배율에서 별 밝기 보정 시작할게.'),
  turn(3, S.od, time(14, 34), '히어로 시안 두 장 찍었어.'),
  turn(4, S.piuda, time(14, 36), '사이드바 접힘 상태 저장 구현 끝.'),
]
const togetherStarts = [started(S.piuda, time(14, 30)), started(S.od, time(14, 30)), started(S.starwrite, time(14, 31))]

const rows = [S.starwrite, S.docs, S.api, S.piuda, S.od].map((name, i) => ({ key: `s-${i}`, sessionId: name, name, at: time(9, 2 + Math.floor(i / 2)) }))
</script>

<template>
  <GalleryCase title="01 · 거의 동시에 시작 · 첫 메시지">
    <ChatFrame note="왼쪽 정렬, 메시지와 같은 열. 가운데 정렬은 날짜 줄만. 세 줄이 간격 2로 붙고, 바로 다음이 묶음 세션(starwrite)의 메시지라 간격 8. 다른 세션 메시지는 평소처럼 20.">
      <FeedPreview :messages="together" :sessions="togetherStarts" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 4개 이상 · 외 n개 · 긴 브랜치">
    <ChatFrame note="다섯 세션이 함께 시작해 셋만 보이고 ‘외 2개’로 접힌다. 누르면 모두 보인다. 디렉터리(starwrite, docs)는 자르지 않고 브랜치만 끝을 …로 줄인다. 마우스를 올리면 전체 이름.">
      <SessionStarts :rows="rows" />
      <SessionStarts :rows="[{ key: 'e2e', sessionId: S.e2e, name: S.e2e, at: time(9, 20) }]" lead />
      <SessionMessage :name="S.e2e" :at="time(9, 21)">
        결제 화면 e2e 시작.
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 시작 줄과 머리줄의 같은 표기">
    <ChatFrame note="같은 starwrite · fix/1011-…가 시작 줄과 메시지 머리줄에서 같은 모양: 한 줄, 디렉터리 fg, 브랜치 muted, 브랜치만 ….">
      <SessionStarts :rows="[{ key: 'sw', sessionId: S.starwrite, name: S.starwrite, at: time(14, 31) }]" lead />
      <SessionMessage :name="S.starwrite" :at="time(14, 31)">
        축소 배율에서 별 밝기 보정 끝.
      </SessionMessage>
      <SessionMessage :name="S.docs" :at="time(14, 50)">
        검색 색인 재생성 스크립트 작성 끝.
      </SessionMessage>
    </ChatFrame>
  </GalleryCase>
</template>
