<script setup lang="ts">
import type { SessionRow } from '../../sessions'
import { computed, ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import AppBar from '../shell/AppBar.vue'
import { SAMPLE_NOW, SAMPLE_SESSIONS } from './gallery-samples'
import SessionPopover from './SessionPopover.vue'

function noop() {}

const ago = (minutes: number) => SAMPLE_NOW - minutes * 60_000
function row(id: string, session: string, extra: Partial<SessionRow>): SessionRow {
  return { id, session, lastSeenAt: ago(1), muted: false, ended: false, live: true, harness: 'claude-code', state: 'idle', ...extra }
}

// 「infect」: two live sessions with one name (told apart by the parent path), and an ended one only a search finds
const INFECT: SessionRow[] = [
  row('iw', 'infectguide', { hint: 'work/', state: 'waiting', lastSeenAt: ago(2) }),
  row('io', 'infectguide', { hint: 'oss/', harness: 'codex', lastSeenAt: ago(14) }),
  row('legacy', 'infectguide-legacy', { ended: true, live: false, state: undefined, lastSeenAt: ago(60 * 20) }),
  ...SAMPLE_SESSIONS,
]

// A long day: every harness and state, a message-only row (no record), and times from 방금 to a date
const MANY: SessionRow[] = [
  row('g', 'gollabara', { branch: 'feat/session-menu', state: 'working', lastSeenAt: SAMPLE_NOW }),
  ...INFECT.slice(0, 2),
  row('oda', 'od', { branch: 'gollabara-app', harness: 'open-design', state: 'working', lastSeenAt: ago(1) }),
  ...SAMPLE_SESSIONS,
  row('sw', 'starwrite', { harness: 'codex', lastSeenAt: ago(70) }),
  row('docs', 'docs', { branch: 'adr-14', state: 'working', lastSeenAt: ago(95) }),
  row('lab', 'lab', { harness: 'codex', state: 'waiting', lastSeenAt: ago(60 * 5) }),
  row('night', 'nightly', { muted: true, lastSeenAt: ago(60 * 16) }),
  { id: 'old', session: 'scratch', lastSeenAt: ago(60 * 24 * 3), muted: false, ended: false, live: true },
]

// Interactive: pick, mute, and the scope falls back to 전체 세션 when muted
const bar = ref<InstanceType<typeof AppBar>>()
const open = ref(false)
const scope = ref<string | null>(null)
const muted = ref(new Set(['api']))
const rows = computed(() => SAMPLE_SESSIONS.map(s => ({ ...s, muted: muted.value.has(s.id) })))
const label = computed(() => rows.value.find(s => s.id === scope.value)?.session ?? '전체 세션')
function pick(id: string | null) {
  scope.value = id
  open.value = false
}
function mute(id: string) {
  const next = new Set(muted.value)
  if (!next.delete(id))
    next.add(id)
  muted.value = next
  if (next.has(id) && scope.value === id)
    scope.value = null
}
</script>

<template>
  <GalleryCase title="열림 · 전체 세션 선택 · 세 하네스, 세 상태 · 음소거한 api는 고를 수 없음 (≤767px에서는 바텀시트)">
    <GalleryStage :height="640">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" :scope="null" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="세션 하나를 보는 중 · od (채움만, 체크와 테두리 없음) · 음소거한 행은 스위치가 꺼짐">
    <GalleryStage :height="640">
      <AppBar scope-label="od · landing-hero" sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" scope="od" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="검색 · 「infect」 · 같은 이름 둘은 흐린 상위 경로로 구분, 끝난 세션은 흐려진 채 ‘끝남’ (고를 수는 있다)">
    <GalleryStage :height="560">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="INFECT" :scope="null" query="infect" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="휴대폰 · 바텀시트 (손잡이는 이 모드에서만, 390에서 확인)">
    <GalleryStage :height="760">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" scope="piuda" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="세션 12개 · 패널 안에서 스크롤 · 기록 없는 세션은 이름 첫 글자, 상태 없음">
    <GalleryStage :height="760">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="MANY" :scope="null" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="실행 중인 세션 없음 · 찾기는 남아 끝난 세션을 찾을 수 있다">
    <GalleryStage :height="420">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS.map(s => ({ ...s, ended: true, live: false, state: undefined }))" :scope="null" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="이름으로 찾기 · 맞는 세션 없음">
    <GalleryStage :height="420">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" :scope="null" query="payments" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="연결 끊김 · 범위와 음소거는 그대로">
    <GalleryStage :height="640">
      <AppBar offline sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" :scope="null" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="모바일 · 트리거 아래에 그대로, 손잡이 없음 (바텀시트의 대안, 390에서 확인)">
    <GalleryStage :height="640">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" :scope="null" mobile="anchored" :now="SAMPLE_NOW" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="직접 열어 보기 · 바깥 누르기 · Esc · Tab 순환 · 표시 스위치">
    <GalleryStage :height="640">
      <AppBar ref="bar" :scope-label="label" :sessions-open="open" @sessions="open = !open">
        <template #sessions>
          <SessionPopover
            v-if="open" :sessions="rows" :scope="scope" :anchor="() => bar?.sessionButton"
            @close="open = false" @select="pick" @mute="mute"
          />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
</template>
