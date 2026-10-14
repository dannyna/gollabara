<script setup lang="ts">
import { computed, ref } from 'vue'
import GalleryCase from '../../gallery/GalleryCase.vue'
import GalleryStage from '../../gallery/GalleryStage.vue'
import { SAMPLE_SESSIONS } from './gallery-samples'
import MentionList from './MentionList.vue'

// The composer here is a stand-in; the real one lives in the chat components
const all = SAMPLE_SESSIONS
const query = ref('@')
const list = ref<InstanceType<typeof MentionList>>()
const matches = computed(() => {
  const q = query.value.match(/@(\S*)$/)?.[1]
  return q == null ? [] : all.filter(s => s.id.includes(q))
})
function pick(id: string) {
  query.value = query.value.replace(/@\S*$/, `@${id} `)
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' && matches.value.length) {
    e.preventDefault()
    list.value?.focusFirst()
  }
}
</script>

<template>
  <GalleryCase title="열림 · @를 치면 컴포저 바로 위에">
    <GalleryStage :height="360">
      <div class="composer">
        <MentionList :options="all" />
        <div class="box">
          <textarea rows="1" aria-label="세션에 메시지 보내기" readonly>@</textarea>
        </div>
        <p class="note">
          Enter로 보내기 · Shift+Enter 줄바꿈
        </p>
      </div>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="맞는 세션 없음 · 목록을 닫고 이유는 안내 줄에">
    <GalleryStage :height="200">
      <div class="composer">
        <div class="box">
          <textarea rows="1" aria-label="세션에 메시지 보내기" readonly>@web</textarea>
        </div>
        <p class="note warn">
          @로 보낼 세션을 골라 주세요
        </p>
      </div>
    </GalleryStage>
  </GalleryCase>
  <GalleryCase title="직접 써 보기 · ↓로 목록에 들어가 ↑↓ · Enter로 고르기 · Esc">
    <GalleryStage :height="360">
      <div class="composer">
        <MentionList ref="list" :options="matches" @pick="pick" @close="query = query.replace(/@\S*$/, '')" />
        <div class="box">
          <textarea v-model="query" rows="1" aria-label="세션에 메시지 보내기" @keydown="onKeydown" />
        </div>
        <p class="note">
          @를 지우고 다시 쳐 보세요
        </p>
      </div>
    </GalleryStage>
  </GalleryCase>
</template>

<style scoped>
.composer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 13px 20px 17px;
  border-radius: 0 0 20px 20px;
  background: var(--surface);
}
.box {
  padding: 9px 10px 8px;
  border-radius: 16px;
  background: var(--bg);
  box-shadow: inset 0 1px 4px oklch(0 0 0 / 0.13);
}
textarea {
  display: block;
  width: 100%;
  min-height: 37px;
  padding: 0 3px;
  border: 0;
  resize: none;
  background: transparent;
  color: var(--fg);
  font-size: 12px;
  line-height: 1.7;
  outline: none;
}
.note {
  margin: 7px 3px 0;
  color: var(--muted);
  font-size: 9px;
}
.note.warn {
  color: var(--fg);
}
</style>
