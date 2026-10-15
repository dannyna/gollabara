<script setup lang="ts">
import type { Question } from '../../../../src/shared/types'
import ChatFrame from '../../gallery/ChatFrame.vue'
import FeedPreview from '../../gallery/FeedPreview.vue'
import { IMG, S, show, time, turn } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'

// Recap line states from the OD guide message-state-components.html §01
const FIX: Question = {
  header: '수정 방향',
  question: '버튼을 어떻게 고칠까요?',
  options: [
    { label: 'A · 버튼 폭 줄이기', description: '라벨을 한 줄로 줄이고 좌우 여백을 줄인다' },
    { label: 'B · 2줄 허용', description: '버튼 높이를 늘려 라벨을 두 줄로' },
  ],
}

const four = [
  turn(1, S.piuda, time(14, 32), '사이드바 접힘 상태를 로컬에 저장하도록 바꿨어. 단축키는 다음 턴에.'),
  turn(2, S.od, time(14, 36), '히어로 B 기준으로 하단 여백 정리 끝. 빌드도 통과했어.'),
  turn(3, S.api, time(14, 39), '마이그레이션 파일을 만들었어. 실행 전에 한 번 봐 줘.'),
  turn(4, S.e2e, time(14, 41), 'e2e 2건 실패 — 결제 버튼이 360px에서 잘려.'),
]
const fourVerdicts = [show(1), show(2, 'success'), show(3, 'warning'), show(4, 'danger')]

const withImages = [
  turn(1, S.starwrite, time(14, 31), '축소 배율에서 별 밝기 보정 끝. 비교 스크린샷 2장.', { images: [IMG.hero, IMG.heroB], toolName: 'mcp__od__screenshot' }),
  turn(2, S.e2e, time(14, 38), 'e2e 2건 실패 — 결제 버튼이 360px에서 잘려.', { images: [IMG.c1], toolName: 'Read' }),
]

const withQuestion = [turn(1, S.e2e, time(14, 41), 'e2e 2건 실패 — 결제 버튼이 360px에서 잘려.', { questions: [FIX] })]

const sequence = [
  turn(1, S.e2e, time(14, 38), 'e2e 2건 실패 — 결제 버튼이 360px에서 잘려.'),
  turn(2, S.e2e, time(14, 40), '버튼 라벨을 한 줄로 줄였어. e2e 다시 돌릴게.'),
  turn(3, S.e2e, time(14, 44), 'e2e 12건 모두 통과. 결제 버튼 잘림 고쳤어.', { images: [IMG.c2], toolName: 'Read' }),
]

const multi = [turn(1, S.api, time(14, 39), ['quota 리필 배치 작성 끝.', '마이그레이션 파일을 만들었어. 실행 전에 한 번 봐 줘.', '테스트 34개 통과.'])]
</script>

<template>
  <GalleryCase title="01 · 네 상태 (기본 · 성공 · 주의 · 위험)">
    <ChatFrame note="같은 상자에 색만 다르다. 상태 색은 아이콘, 1px 테두리, 옅은 면에만 쓰고 본문은 언제나 fg. 아이콘은 아바타 열에 있어 글자의 시작점이 네 상태 모두 같다. 스크린 리더는 ‘성공:’ 같은 접두어를 읽는다.">
      <FeedPreview :messages="four" :triage="fourVerdicts" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 이미지가 있는 턴">
    <ChatFrame note="상자는 요약 줄만 감싼다. 썸네일과 도구 줄은 상자 밖, 지금 자리 그대로.">
      <FeedPreview :messages="withImages" :triage="[show(1, 'success'), show(2, 'danger')]" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 질문 카드가 있는 턴">
    <ChatFrame note="질문 카드는 상태를 받지 않는다. 줄만 상태를 받는다.">
      <FeedPreview :messages="withQuestion" :triage="[show(1, 'danger')]" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 위험 → 기본 → 성공 (같은 세션)">
    <ChatFrame note="세션마다 채운 상자는 하나. 성공이 오면 14:38의 위험 줄은 면과 테두리를 내려놓고 아이콘만 남는다. ‘해결됨’이라고 쓰지 않는다. 기본 줄은 이전 상태를 끄지 않는다.">
      <FeedPreview :messages="sequence" :triage="[show(1, 'danger'), show(2), show(3, 'success')]" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04b · 위험 뒤 진행 보고만 왔을 때">
    <ChatFrame note="기본 줄 사이에도 마지막 위험은 채운 채로 남는다.">
      <FeedPreview :messages="sequence.slice(0, 2)" :triage="[show(1, 'danger'), show(2)]" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="05 · 한 턴에 여러 줄">
    <ChatFrame note="줄마다 따로 판정한다. 상자 사이 간격 4. 마지막 상태 줄(성공)만 채우고 앞의 주의는 아이콘만 남는다.">
      <FeedPreview :messages="multi" :triage="[show(1), show(1, 'warning', 1), show(1, 'success', 2)]" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="06 · 대화 정리 꺼짐">
    <ChatFrame note="엔진이 꺼져 있으면 저장된 판정이 있어도 모든 줄이 기본.">
      <FeedPreview :messages="four" :triage="fourVerdicts" engine="off" />
    </ChatFrame>
  </GalleryCase>
</template>
