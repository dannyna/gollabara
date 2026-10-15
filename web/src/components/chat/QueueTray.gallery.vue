<script setup lang="ts">
import ChatFrame from '../../gallery/ChatFrame.vue'
import { S, time } from '../../gallery/fixtures'
import GalleryCase from '../../gallery/GalleryCase.vue'
import ChatComposer from './ChatComposer.vue'
import MyMessage from './MyMessage.vue'
import QueueTray from './QueueTray.vue'
import SessionMessage from './SessionMessage.vue'
import SystemLine from './SystemLine.vue'
</script>

<template>
  <GalleryCase title="01 · 대기 1건">
    <ChatFrame note="작업 중인 od에 보낸 말이 트레이로. 타임라인에는 아직 아무것도 없다.">
      <SessionMessage :name="S.od" :at="time(14, 38)">
        하단 여백 줄이는 중이야.
      </SessionMessage>
      <template #footer>
        <ChatComposer can-send target="od">
          <template #tray>
            <QueueTray note="턴이 끝나면 보낼게요" :groups="[{ session: 'od', status: '작업 중', items: ['모바일 360px도 한 장 찍어 줘'], next: true }]" />
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02 · 여러 세션">
    <ChatFrame note="세션별 묶음. 각 묶음의 첫 건에 ‘다음’.">
      <SessionMessage :name="S.od" :at="time(14, 38)">
        하단 여백 줄이는 중이야.
      </SessionMessage>
      <template #footer>
        <ChatComposer can-send target="od">
          <template #tray>
            <QueueTray
              note="세션마다 턴이 끝나면 하나씩 보낼게요" :groups="[
                { session: 'od', status: '작업 중', items: ['모바일 360px도 한 장 찍어 줘', 'CTA 문구는 그대로 둬'], next: true },
                { session: 'piuda', status: '작업 중', items: ['e2e 결과 나오면 실패한 것만 정리해 줘'], next: true },
              ]"
            />
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="02b · 전달 경로가 다른 세션">
    <ChatFrame note="깨우기 hook이 살아 있는 Claude Code 세션과 Codex 세션. 헤더는 다르다고만 말하고, 묶음마다 자기 경로를.">
      <template #footer>
        <ChatComposer can-send target="od" route="바로 전달돼요">
          <template #tray>
            <QueueTray
              note="세션마다 전달 시점이 달라요" :actions="false" :groups="[
                { session: 'od', items: ['모바일 360px도 한 장 찍어 줘'], route: '바로 전달돼요' },
                { session: 'api', items: ['테스트 실패만 정리해 줘'], route: '세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요' },
              ]"
            />
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="03 · 가득 참 · 세션당 3건">
    <ChatFrame note="od로의 전송만 꺼진다. 대상을 다른 세션으로 바꾸면 다시 켜진다.">
      <SessionMessage :name="S.od" :at="time(14, 38)">
        하단 여백 줄이는 중이야.
      </SessionMessage>
      <template #footer>
        <ChatComposer can-send target="od" text="다크 테마도 확인해 줘" :blocked="{ icon: 'alert', text: 'od 대기가 가득 찼어요 — 하나를 지우면 더 보낼 수 있어요' }">
          <template #tray>
            <QueueTray note="od는 3건까지 기다릴 수 있어요" :groups="[{ session: 'od', status: '작업 중', items: ['모바일 360px도 한 장 찍어 줘', 'CTA 문구는 그대로 둬', '히어로 B 기준으로 태블릿도'], next: true }]" />
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="04 · 하나씩 전달">
    <ChatFrame note="턴이 끝나 첫 건이 말풍선이 됐다. 남은 건은 다음 턴 끝에. 다 나가면 트레이가 사라진다.">
      <SessionMessage :name="S.od" :at="time(14, 40)">
        하단 여백 줄였어. 스크린샷 다시 찍을게.
      </SessionMessage>
      <MyMessage target="od" text="모바일 360px도 한 장 찍어 줘" :at="time(14, 40)" />
      <template #footer>
        <ChatComposer can-send target="od">
          <template #tray>
            <QueueTray note="앞 메시지 답이 끝나면 이어서 보낼게요" :groups="[{ session: 'od', status: '작업 중', items: ['CTA 문구는 그대로 둬'], next: true }]" />
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="05 · 세션 멈춤">
    <ChatFrame note="멈춘 동안은 보내지 않는다. 재개하면 순서대로 이어서.">
      <SystemLine icon="pause" :text="`${S.e2e} 멈춤`" />
      <template #footer>
        <ChatComposer can-send target="client-e2e">
          <template #tray>
            <QueueTray note="client-e2e를 재개하면 보낼게요" :groups="[{ session: 'client-e2e', status: '멈춤', items: ['결제 버튼 잘림 다시 확인해 줘'] }]" />
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
  <GalleryCase title="06 · 세션 끝남">
    <ChatFrame note="끝난 세션에는 보낼 수 없다. 편집해 다른 세션으로 보내거나 지운다.">
      <SystemLine icon="end" :text="`${S.piuda} 끝남`" />
      <template #footer>
        <ChatComposer can-send target="piuda" :blocked="{ icon: 'alert', text: 'piuda는 끝난 세션이에요 — @로 다른 세션을 골라 주세요' }">
          <template #tray>
            <QueueTray note="보낼 수 없어요 — 편집해 다른 세션으로 보내거나 지워 주세요" :groups="[{ session: 'piuda', status: '끝남', items: ['e2e 결과 나오면 실패한 것만 정리해 줘'] }]" />
          </template>
        </ChatComposer>
      </template>
    </ChatFrame>
  </GalleryCase>
</template>
