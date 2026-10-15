<script setup lang="ts">
import { ref } from 'vue'
import ChatFrame from '../../gallery/ChatFrame.vue'
import { S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import { sessionMenuItems } from './chat'
import SessionAvatar from './SessionAvatar.vue'
import SessionMenu from './SessionMenu.vue'
import SessionMenuButton from './SessionMenuButton.vue'
import SessionMessage from './SessionMessage.vue'
import SessionName from './SessionName.vue'
import SystemLine from './SystemLine.vue'

// Interactive: the rows flip with the scope and mute they change
const scope = ref<string | null>(null)
const muted = ref(new Set<string>())
function toggleScope(name: string) {
  scope.value = scope.value === name ? null : name
}
function toggleMute(name: string) {
  const next = new Set(muted.value)
  if (!next.delete(name))
    next.add(name)
  muted.value = next
  if (next.has(name) && scope.value === name)
    scope.value = null
}
</script>

<template>
  <GalleryCase title="01 · 머리줄 버튼 — 눌러 보기">
    <ChatFrame :note="`평소에는 지금 머리줄과 같고, hover · 키보드 포커스에 면 · 아바타 테두리 · ⌄. 터치에서는 ⌄를 늘 보이고 높이 44. 보기 범위: ${scope ?? '전체 세션'} · 음소거: ${[...muted].join(', ') || '없음'}`">
      <SessionMessage
        v-for="name in [S.piuda, S.od]" :key="name" :name="name" :at="time(14, 32)" :scoped="scope === name"
        @scope="toggleScope(name)" @mute="toggleMute(name)"
      >
        사이드바 접힘 상태 저장 구현 끝.
      </SessionMessage>
      <SystemLine icon="mute" text="음소거함">
        <template #lead>
          <SessionMenuButton
            small :name="S.api" :muted="muted.has(S.api)" :scoped="scope === S.api"
            @scope="toggleScope(S.api)" @mute="toggleMute(S.api)"
          />
        </template>
      </SystemLine>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 열림 · 전체 세션을 보는 중">
    <ChatFrame note="머리줄 바로 아래, 아바타 왼쪽 끝에 맞춰 폭 224. 첫 줄은 어느 세션의 메뉴인지 mono로.">
      <div class="stage">
        <div class="anchor">
          <SessionAvatar :name="S.od" /><strong><SessionName :name="S.od" /></strong>
          <SessionMenu preview :name="S.od" :items="sessionMenuItems(false, false)" />
        </div>
      </div>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 열림 · 그 세션만 보는 중">
    <ChatFrame note="보기 범위가 od라서 첫 항목이 ‘전체 세션 보기’. 여기서 음소거하면 범위가 ‘전체 세션’으로 돌아간다.">
      <div class="stage">
        <div class="anchor">
          <SessionAvatar :name="S.od" /><strong><SessionName :name="S.od" /></strong>
          <SessionMenu preview :name="S.od" :items="sessionMenuItems(true, false)" />
        </div>
      </div>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03b · 끝난 세션 · 머리줄과 메뉴">
    <ChatFrame note="세션이 끝나면(SessionEnd, 또는 프로세스가 사라지면) 아바타는 점선 테두리, 이름과 본문은 muted, 이름 뒤에 ‘끝남’. 이미지는 받은 그대로. 메뉴 첫 줄도 ‘끝남’을 말한다.">
      <SessionMessage :name="S.api" :at="time(14, 20)" ended>
        쿼터 리필 배치 정리하고 종료.
      </SessionMessage>
      <div class="stage">
        <div class="anchor">
          <SessionAvatar :name="S.api" ended /><strong class="faded"><SessionName :name="S.api" /></strong>
          <SessionMenu preview :name="S.api" ended :items="sessionMenuItems(false, false)" />
        </div>
      </div>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 음소거한 세션 · 시스템 줄에서">
    <ChatFrame note="음소거한 세션의 메시지는 대화에 없으므로 시스템 줄의 작은 아바타가 진입점. ‘이 세션만 보기’는 세션 메뉴처럼 꺼진다.">
      <div class="stage">
        <div class="anchor centred">
          <SessionAvatar :name="S.api" small />{{ S.api }} 음소거함
          <SessionMenu preview :name="S.api" :items="sessionMenuItems(false, true)" />
        </div>
      </div>
    </ChatFrame>
  </GalleryCase>
</template>

<style scoped>
.stage {
  min-height: 160px;
}
.anchor {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.faded {
  color: var(--muted);
}
.centred {
  justify-content: center;
  gap: 6px;
  font-size: 10px;
  color: var(--muted);
}
.centred :deep(.session-menu) {
  left: 50%;
  transform: translateX(-50%);
}
</style>
