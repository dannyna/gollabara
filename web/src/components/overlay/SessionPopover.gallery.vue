<script setup lang="ts">
import { computed, ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import AppBar from '../shell/AppBar.vue'
import { SAMPLE_SESSIONS } from './gallery-samples'
import SessionPopover from './SessionPopover.vue'

function noop() {}

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
  <GalleryCase title="열림 · 전체 세션 · 음소거한 api는 고를 수 없음 (≤767px에서는 바텀시트)">
    <GalleryStage :height="760">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" :scope="null" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="세션 하나를 보는 중 · od">
    <GalleryStage :height="760">
      <AppBar scope-label="od · landing-hero" sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" scope="od" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="연결 끊김 · 범위와 음소거는 그대로">
    <GalleryStage :height="760">
      <AppBar offline sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" :scope="null" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="모바일 · 트리거 아래에 그대로 (바텀시트의 대안, 390에서 확인)">
    <GalleryStage :height="760">
      <AppBar sessions-open>
        <template #sessions>
          <SessionPopover :sessions="SAMPLE_SESSIONS" :scope="null" mobile="anchored" preview @close="noop" />
        </template>
      </AppBar>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="직접 열어 보기 · 바깥 누르기 · Esc · Tab 순환">
    <GalleryStage :height="760">
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
