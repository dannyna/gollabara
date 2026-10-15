<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { HERO_SHORT, IMG, S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import ArtifactThumbs from './ArtifactThumbs.vue'
import ChatComposer from './ChatComposer.vue'
import DateLabel from './DateLabel.vue'
import MyMessage from './MyMessage.vue'
import QuestionCard from './QuestionCard.vue'
import QueueTray from './QueueTray.vue'
import SessionMessage from './SessionMessage.vue'
import SessionStarts from './SessionStarts.vue'

const hero = [{ key: 'a', label: 'A', ...IMG.hero }, { key: 'b', label: 'B', ...IMG.heroB }]
const odStart = [{ key: 'od', sessionId: S.od, name: S.od, at: time(14, 33) }]
</script>

<template>
  <GalleryCase title="01 · 한 장면에 여섯 줄">
    <ChatFrame note="세션 메시지 · 산출물 묶음 · 질문 카드 · 내 메시지 · 시작 줄이 한 흐름에 섞인다. 간격은 메시지 사이 20, 날짜 줄 아래 21.">
      <DateLabel label="오늘" />
      <SessionStarts :rows="odStart" lead />
      <SessionMessage :name="S.od" :at="time(14, 34)">
        히어로 시안 두 장 찍었어.
        <ArtifactThumbs :thumbs="hero" tool-name="mcp__open-design__screenshot" />
      </SessionMessage>
      <SessionMessage :name="S.od" :at="time(14, 35)">
        시안 3개 올렸어. 하나 골라 줘.<QuestionCard :question="HERO_SHORT" />
      </SessionMessage>
      <MyMessage target="od" text="B로 가자. 하단 여백만 줄여 줘" :quote="{ text: '히어로 B', image: IMG.heroB.url }" :at="time(14, 36)" />
      <template #footer>
        <ChatComposer can-send target="od">
          <template #tray>
            <QueueTray note="턴이 끝나면 보낼게요" :groups="[{ id: 'od', session: 'od', status: '작업 중', items: [{ text: '모바일 360px도 한 장 찍어 줘' }], next: true }]" />
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="app · 지금 앱이 그리는 장면 (답하기 · 보내기 꺼짐)">
    <ChatFrame note="실제 앱은 받은 것만 그린다: 날짜 줄 · 시작 줄 · 턴 · 질문 카드. 내 메시지와 트레이는 없다.">
      <DateLabel label="오늘" />
      <SessionStarts :rows="odStart" lead />
      <SessionMessage :name="S.od" :at="time(14, 34)">
        <p>히어로 시안 두 장 찍었어.</p>
        <ArtifactThumbs :thumbs="hero" />
      </SessionMessage>
      <SessionMessage :name="S.od" :at="time(14, 35)">
        <QuestionCard :question="HERO_SHORT" inert />
      </SessionMessage>
      <template #footer>
        <ChatComposer hint="@세션을 부르거나, 산출물에 답장해 보세요" note="보내기는 준비 중이에요" />
      </template>
    </ChatFrame>
  </GalleryCase>
</template>
