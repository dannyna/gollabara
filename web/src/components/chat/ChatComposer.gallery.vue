<script setup lang="ts">
import type { ComposerAttachment, ComposerSend } from './ChatComposer.vue'
import { ref } from 'vue'
import ChatFrame from '../../gallery/ChatFrame.vue'
import { IMG } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import ChatComposer from './ChatComposer.vue'
import SessionAvatar from './SessionAvatar.vue'

const HERO_A: ComposerAttachment = { url: IMG.hero.url, session: 'od', caption: '히어로 A · 14:34' }

// Live case: type, Enter, and the emitted payload shows below; nothing is sent anywhere
const attachment = ref<ComposerAttachment | null>(HERO_A)
const sent = ref<ComposerSend[]>([])

// The @세션 picker is an anchored list owned by the overlay components (#17);
// it is sketched here only to show the composer state
const MENTION = [
  { name: 'piuda', state: '쉬는 중' },
  { name: 'od', state: '작업 중' },
  { name: 'client-e2e', state: '멈춤' },
]
</script>

<template>
  <GalleryCase title="01 · 기본 · 대상 지정">
    <ChatFrame note="세션 하나를 보고 있으면 그 세션이 대상 칩으로.">
      <template #footer>
        <ChatComposer can-send target="od" />
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 산출물 인용">
    <ChatFrame note="스트림에서 ‘답장’을 누르면 인용 줄이 붙는다. ×로 취소.">
      <template #footer>
        <ChatComposer can-send target="od" text="여기 카피 한 줄로" :attachment="HERO_A" />
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · @세션 고르기">
    <ChatFrame note="‘전체 세션’ 보기에서는 @로 대상을 고른다. 세션 상태를 오른쪽에. 목록 자체는 오버레이 컴포넌트(#17) 몫.">
      <div class="mention-room" />
      <template #footer>
        <ChatComposer can-send text="@" note="보낼 세션을 골라 주세요">
          <template #popover>
            <div class="mention-list" role="listbox" aria-label="멘션할 세션">
              <div class="mention-title">
                보낼 세션
              </div>
              <button v-for="s in MENTION" :key="s.name" type="button" role="option">
                <SessionAvatar :name="s.name" /><span>{{ s.name }}</span><span>{{ s.state }}</span>
              </button>
            </div>
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 대상 필요">
    <ChatFrame note="대상 없이 쓰면 전송을 끄고 이유를 안내 줄에.">
      <template #footer>
        <ChatComposer can-send text="버튼 잘림 확인해 줘" :blocked="{ icon: 'alert', text: '@로 보낼 세션을 골라 주세요' }" />
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="05 · 연결 끊김">
    <ChatFrame note="써 둔 글은 남기고 전송만 막는다.">
      <template #footer>
        <ChatComposer can-send target="od" text="다크 테마도 확인해 줘" :blocked="{ icon: 'plug', text: '다시 연결되면 보낼 수 있어요' }" />
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="live · send emit + 인용 제거">
    <ChatFrame note="Enter로 send를 내보낸다(Shift+Enter 줄바꿈). ×는 인용을 지운다. 아래는 받은 payload.">
      <pre v-for="(p, i) in sent" :key="i" class="payload mono">{{ JSON.stringify({ text: p.text, attachment: p.attachment?.caption }) }}</pre>
      <template #footer>
        <ChatComposer v-model:attachment="attachment" can-send target="od" @send="sent.push($event)" />
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="app · canSend 꺼짐 (기본값)">
    <ChatFrame note="전달이 연결되기 전 앱이 그리는 상태. 모든 컨트롤이 꺼져 있다.">
      <template #footer>
        <ChatComposer hint="@세션을 부르거나, 산출물에 답장해 보세요" note="보내기는 준비 중이에요" />
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="app · canSend 꺼짐 · 연결 끊김">
    <ChatFrame note="막힌 이유가 평소 안내 자리를 대신한다(InlineNote blocked). 입력창의 aria-describedby가 이 줄을 가리킨다.">
      <template #footer>
        <ChatComposer hint="@세션을 부르거나, 산출물에 답장해 보세요" :blocked="{ icon: 'plug', text: '다시 연결되면 보낼 수 있어요' }" note="보내기는 준비 중이에요" />
      </template>
    </ChatFrame>
  </GalleryCase>
</template>

<style scoped>
.payload {
  margin: 0 0 8px;
  white-space: pre-wrap;
  color: var(--muted);
}
.mention-room {
  min-height: 190px;
}
.mention-list {
  position: absolute;
  z-index: 5;
  left: 20px;
  right: 20px;
  bottom: calc(100% - 3px);
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 -8px 30px var(--shade);
}
.mention-title {
  padding: 3px 8px 6px;
  font-size: 10px;
  color: var(--muted);
}
.mention-list button {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 11px;
  text-align: left;
}
.mention-list button span:last-child {
  margin-left: auto;
  font-size: 10px;
  color: var(--muted);
}
</style>
