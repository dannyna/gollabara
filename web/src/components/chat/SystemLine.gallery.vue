<script setup lang="ts">
import type { IconName } from './icons'
import ChatFrame from '../../gallery/ChatFrame.vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import DateLabel from './DateLabel.vue'
import SystemLine from './SystemLine.vue'

const LINES: { icon: IconName, text: string, note: string }[] = [
  { icon: 'start', text: 'od · landing-hero 시작', note: '세션이 처음 이벤트를 보냈을 때. 같은 세션에 한 번.' },
  { icon: 'pause', text: 'client-e2e · checkout 멈춤', note: '세션 메뉴에서 멈춤. 대기 트레이 자동 전달도 멈춘다.' },
  { icon: 'play', text: 'client-e2e · checkout 재개', note: '재개하면 대기 중인 말을 턴 끝에 이어서 보낸다.' },
  { icon: 'mute', text: 'api · quota-refill 음소거함', note: '‘전체 세션’ 보기에서만 보인다. 이후 이 세션 메시지는 숨긴다.' },
  { icon: 'sound', text: 'api · quota-refill 음소거 해제', note: '숨겼던 동안의 메시지는 다시 보이지 않는다(받지 않았으므로).' },
  { icon: 'plug', text: '연결이 끊겼어요 · 다시 연결 중', note: '앱바의 ‘다시 연결 중’과 짝. 다시 연결되면 ‘다시 연결됐어요’ 한 줄로 바꾼다.' },
  { icon: 'plug', text: '다시 연결됐어요', note: '끊김 줄을 대신하는 한 줄.' },
  { icon: 'end', text: 'piuda · desktop-shell 끝남', note: '끝난 세션. 대기 중인 말은 자동으로 보내지 않는다.' },
]
</script>

<template>
  <GalleryCase v-for="(l, i) in LINES" :key="i" :title="`${l.icon} · ${l.text}`">
    <ChatFrame :note="l.note">
      <SystemLine :icon="l.icon" :text="l.text" />
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="date label · 오늘 / 어제 / 날짜">
    <ChatFrame note="하루가 바뀔 때마다 가운데 한 줄. 오늘 · 어제 · 그 전은 날짜.">
      <DateLabel label="10월 12일 (월)" />
      <DateLabel label="어제" />
      <DateLabel label="오늘" />
    </ChatFrame>
  </GalleryCase>
</template>
