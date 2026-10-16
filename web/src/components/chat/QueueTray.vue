<script setup lang="ts">
import { computed } from 'vue'
import ChatIcon from './ChatIcon.vue'
import SessionAvatar from './SessionAvatar.vue'

// Messages waiting for a session to pick them up, above the composer. Waiting is
// not a warning, so no accent colour.
export interface QueueItem {
  /** The server's feedback id; only items with one can be discarded */
  id?: number
  text: string
}

export interface QueueGroup {
  /** Session id: two sessions can share a short name */
  id: string
  /** Short name shown */
  session: string
  /** Parent path before the name when another session has the same short name (names.ts) */
  hint?: string
  /** 작업 중 · 멈춤 · 끝남; left out when the state is unknown */
  status?: string
  items: QueueItem[]
  /** How the session will get them, when the waiting sessions differ (the header then says so) */
  route?: string
  /** Marks the first item 「다음」 */
  next?: boolean
  /** The session ended: its items stay but fade, since nothing will pick them up unless it resumes; each can be discarded */
  ended?: boolean
}

const props = withDefaults(defineProps<{
  groups: QueueGroup[]
  note: string
  /** 편집 · 삭제; off where nothing backs them yet */
  actions?: boolean
}>(), { actions: true })
defineEmits<{ discard: [sessionId: string, id: number] }>()
const total = computed(() => props.groups.reduce((n, g) => n + g.items.length, 0))
</script>

<template>
  <div class="qtray" role="region" aria-label="대기 중인 메시지">
    <div class="qt-h">
      <ChatIcon name="clock" /><span><b>대기 {{ total }}건</b> · {{ note }}</span>
    </div>
    <div v-for="g in groups" :key="g.id" class="qt-group" :class="{ ended: g.ended }">
      <div class="qt-who">
        <SessionAvatar :name="g.session" small :ended="g.ended" />{{ g.hint }}{{ g.session }}<span v-if="g.status || g.route" class="st">{{ [g.status, g.route].filter(Boolean).join(' · ') }}</span>
      </div>
      <div v-for="(item, i) in g.items" :key="item.id ?? i" class="qi" :class="{ next: g.next && i === 0 }">
        <p>{{ item.text }}</p>
        <!-- Nothing will pick an ended session's item up, so it can go -->
        <div v-if="g.ended && item.id != null" class="qi-a">
          <button type="button" :aria-label="`대기 메시지 지우기: ${item.text}`" @click="$emit('discard', g.id, item.id)">
            지우기
          </button>
        </div>
        <div v-else-if="actions" class="qi-a">
          <button type="button">
            편집
          </button>
          <button type="button">
            삭제
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qtray {
  margin: 0 20px -12px;
  padding: 10px 12px 22px;
  border-radius: 16px 16px 0 0;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.qt-h {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}
.qt-h .chat-icon {
  width: 13px;
  height: 13px;
  margin-top: 2px;
}
.qt-h b {
  color: var(--fg);
  font-weight: 600;
  white-space: nowrap;
}
.qt-group {
  margin-top: 9px;
}
.qt-who {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 10px;
  color: var(--muted);
}
.st {
  margin-left: auto;
}
.qi {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0 6px 23px;
}
.qi p {
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 12px;
  line-height: 1.6;
}
.ended .qi p {
  color: var(--muted);
}
.qi.next p::before {
  content: '다음';
  margin-right: 6px;
  font: 500 10px var(--body);
  color: var(--muted);
}
.qi-a {
  display: flex;
  flex: none;
}
.qi-a button {
  min-height: 28px;
  padding: 0 7px;
  border-radius: 7px;
  font-size: 11px;
  color: var(--fg);
}
@media (min-width: 768px) and (max-width: 1023px) {
  .qtray {
    margin: 0 22px -12px;
  }
}
@media (max-width: 767px) {
  .qtray {
    margin: 0 12px -12px;
  }
}
@media (max-width: 767px), (pointer: coarse) {
  .qi-a button {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
