<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { StoredImage, StreamMessage } from '../../src/shared/types'
import { useStream } from './useStream'

const { messages, connected } = useStream()

// 세션 필터 — 기본은 전체
const filter = ref<string | null>(null)
const sessions = computed(() => {
  const seen = new Map<string, string>()
  for (const m of messages.value) seen.set(m.sessionId, m.sessionName)
  return [...seen].map(([id, name]) => ({ id, name }))
})
const visible = computed(() => filter.value ? messages.value.filter(m => m.sessionId === filter.value) : messages.value)

// 콘텐츠 패널: 이미지를 칸 단위로 펼친다
interface Column { key: string, messageId: number, image: StoredImage, sessionId: string, sessionName: string, at: number, newSession: boolean }
const columns = computed<Column[]>(() => {
  const out: Column[] = []
  for (const m of visible.value) {
    m.images?.forEach((image, i) => {
      out.push({
        key: `${m.id}-${i}`,
        messageId: m.id,
        image,
        sessionId: m.sessionId,
        sessionName: m.sessionName,
        at: m.at,
        newSession: out.length > 0 && out.at(-1)!.sessionId !== m.sessionId,
      })
    })
  }
  return out
})

// 칸 ↔ 채팅 메시지 연결
const selected = ref<string | null>(null)
const selectedMessage = computed(() => columns.value.find(c => c.key === selected.value)?.messageId ?? null)
const track = ref<HTMLElement>()
const feed = ref<HTMLElement>()

function selectColumn(key: string) {
  selected.value = key
  const id = columns.value.find(c => c.key === key)?.messageId
  feed.value?.querySelector(`[data-msg="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
function selectThumb(m: StreamMessage, i: number) {
  if (window.matchMedia('(max-width: 767px)').matches) {
    viewer.value = m.images![i]!
    return
  }
  const key = `${m.id}-${i}`
  selected.value = key
  track.value?.querySelector(`[data-col="${key}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}

// 크게 보기
const viewer = ref<StoredImage | null>(null)

// 최신 따라가기: 사용자가 과거로 스크롤해 두면 따라가지 않고 「새 이미지 n」만 띄운다
const following = ref(true)
const unseen = ref(0)
// 이미지가 늦게 로드되며 트랙이 넓어지는 스크롤은 사용자 의도가 아니다 — 직접 조작했을 때만 따라가기를 끈다
let userIntentUntil = 0
function markUserIntent() {
  userIntentUntil = Date.now() + 800
}
function onTrackScroll() {
  const el = track.value!
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 40
  if (atEnd) {
    following.value = true
    unseen.value = 0
  }
  else if (Date.now() < userIntentUntil) {
    following.value = false
  }
}
function onImageLoad() {
  if (following.value)
    track.value?.scrollTo({ left: track.value.scrollWidth })
}
function jumpToLatest() {
  const el = track.value!
  el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  unseen.value = 0
}
watch(() => columns.value.length, async (n, prev) => {
  await nextTick()
  if (following.value)
    track.value?.scrollTo({ left: track.value.scrollWidth, behavior: prev ? 'smooth' : 'auto' })
  else
    unseen.value += n - (prev ?? 0)
})
watch(() => visible.value.length, async () => {
  await nextTick()
  feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' })
})

const time = (at: number) => new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
const initials = (name: string) => name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase()
function hue(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 45% 42%)`
}
</script>

<template>
  <div class="frame">
    <section class="content">
      <header class="ctop">
        <b>결과물</b>
        <span class="muted">이미지 {{ columns.length }} · 세션 {{ sessions.length }}</span>
        <span class="sp" />
        <span v-if="following" class="live">최신을 따라가는 중</span>
        <button v-else class="pill" @click="jumpToLatest">
          {{ unseen ? `새 이미지 ${unseen}` : '최신으로' }} →
        </button>
      </header>
      <div
        ref="track" class="track" @scroll.passive="onTrackScroll"
        @wheel.passive="markUserIntent" @pointerdown="markUserIntent" @touchstart.passive="markUserIntent" @keydown="markUserIntent"
      >
        <p v-if="!columns.length" class="empty">
          세션이 스크린샷을 찍으면 여기로 흘러옵니다.
        </p>
        <template v-for="c in columns" :key="c.key">
          <div v-if="c.newSession" class="sep" />
          <figure
            class="col" :class="{ sel: selected === c.key }" :data-col="c.key"
            @click="selectColumn(c.key)" @dblclick="viewer = c.image"
          >
            <figcaption class="meta">
              <span class="dot" :style="{ background: hue(c.sessionId) }" />
              <b>{{ c.sessionName }}</b>{{ time(c.at) }} · {{ c.image.width }}×{{ c.image.height }}
            </figcaption>
            <img :src="c.image.url" :style="{ aspectRatio: `${c.image.width} / ${c.image.height}` }" alt="" @load="onImageLoad">
          </figure>
        </template>
      </div>
    </section>

    <aside class="chat">
      <header class="chead">
        <b>스트림</b>
        <span class="conn" :class="{ on: connected }" :title="connected ? '연결됨' : '다시 연결하는 중'" />
        <div class="filters">
          <button class="flt" :class="{ on: !filter }" @click="filter = null">
            전체
          </button>
          <button v-for="s in sessions" :key="s.id" class="flt" :class="{ on: filter === s.id }" @click="filter = s.id">
            {{ s.name }}
          </button>
        </div>
      </header>
      <div ref="feed" class="feed">
        <div v-for="m in visible" :key="m.id" class="msg" :class="{ linked: selectedMessage === m.id }" :data-msg="m.id">
          <div class="av" :style="{ background: hue(m.sessionId) }">
            {{ initials(m.sessionName) }}
          </div>
          <div class="main">
            <div class="who">
              {{ m.sessionName }}<span>{{ time(m.at) }}{{ m.kind === 'recap' ? ' · 턴 끝' : '' }}{{ m.kind === 'image' ? ` · 이미지 ${m.images?.length}` : '' }}</span>
            </div>
            <p v-if="m.text" class="body">
              {{ m.text }}
            </p>
            <div v-if="m.images" class="thumbs">
              <img
                v-for="(img, i) in m.images" :key="i" :src="img.url" alt=""
                :class="{ sel: selected === `${m.id}-${i}` }" :style="{ aspectRatio: `${img.width} / ${img.height}` }"
                @click="selectThumb(m, i)"
              >
            </div>
            <div v-for="(q, qi) in m.questions" :key="qi" class="q">
              <small>세션이 물은 질문</small>
              {{ q.question }}
              <div class="opts">
                <span v-for="o in q.options" :key="o.label" class="opt" :title="o.description">{{ o.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="input">
        메시지 보내기는 다음 단계에서 붙습니다
      </div>
    </aside>

    <div v-if="viewer" class="viewer" @click="viewer = null">
      <img :src="viewer.url" alt="">
    </div>
  </div>
</template>

<style scoped>
.frame { height: 100%; display: grid; grid-template-columns: 1fr 440px; }
.content { display: flex; flex-direction: column; min-width: 0; border-right: 1px solid var(--line); }
.ctop, .chead { height: 56px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 24px; border-bottom: 1px solid var(--line); font-size: 14px; }
.ctop b, .chead b { font-size: 15px; }
.sp { flex: 1; }
.muted { color: var(--muted); font-size: 13px; }
.live { font-size: 12px; color: var(--ok); display: flex; align-items: center; gap: 6px; }
.live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
.pill { font-size: 12px; padding: 5px 12px; border-radius: 999px; border: 0; background: var(--text); color: var(--bg); }

.track { flex: 1; display: flex; align-items: center; gap: 18px; padding: 0 28px; overflow-x: auto; overflow-y: hidden; }
.empty { color: var(--muted); font-size: 14px; margin: auto; }
.col { flex: none; height: calc(100% - 64px); display: flex; flex-direction: column; gap: 8px; cursor: pointer; }
.col img { flex: 1; min-height: 0; height: 100%; width: auto; object-fit: contain; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
.col.sel img { outline: 3px solid var(--select); outline-offset: 2px; }
.col.sel .meta b { color: var(--select); }
.meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); white-space: nowrap; }
.meta b { color: var(--text); font-weight: 600; }
.dot { width: 8px; height: 8px; border-radius: 3px; flex: none; }
.sep { flex: none; width: 1px; height: calc(100% - 40px); background: repeating-linear-gradient(var(--line) 0 6px, transparent 6px 12px); }

.chat { display: flex; flex-direction: column; min-height: 0; }
.chead { padding: 0 20px; gap: 8px; }
.conn { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); flex: none; }
.conn.on { background: var(--ok); }
.filters { display: flex; gap: 6px; overflow-x: auto; margin-left: 4px; scrollbar-width: none; }
.flt { font-size: 12px; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); white-space: nowrap; }
.flt.on { background: var(--text); color: var(--bg); border-color: var(--text); }
.feed { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.msg { display: flex; gap: 10px; border-radius: 10px; padding: 4px; margin: -4px; transition: background .2s; }
.msg.linked { background: var(--sunken); }
.main { min-width: 0; flex: 1; }
.av { width: 30px; height: 30px; border-radius: 8px; flex: none; color: #fff; font-size: 11px; display: grid; place-items: center; font-weight: 700; }
.who { font-size: 13px; font-weight: 700; }
.who span { font-weight: 400; color: var(--muted); margin-left: 6px; }
.body { font-size: 14px; line-height: 1.5; margin-top: 2px; overflow-wrap: anywhere; }
.thumbs { display: flex; gap: 6px; margin-top: 6px; align-items: flex-end; flex-wrap: wrap; }
.thumbs img { height: 48px; width: auto; border-radius: 5px; border: 1px solid var(--line); cursor: pointer; object-fit: cover; }
.thumbs img.sel { outline: 2px solid var(--select); outline-offset: 1px; }
.q { background: var(--accent-soft); border: 1px solid var(--accent-line); border-radius: 10px; padding: 10px 12px; margin-top: 6px; font-size: 14px; }
.q small { display: block; font-size: 11px; color: var(--accent); margin-bottom: 4px; }
.opts { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.opt { font-size: 13px; padding: 5px 11px; border-radius: 8px; border: 1px solid var(--accent-line); background: var(--surface); }
.input { margin: 12px 20px 18px; border: 1px dashed var(--line); border-radius: 12px; padding: 12px 14px; font-size: 13px; color: var(--muted); }

.viewer { position: fixed; inset: 0; background: rgb(0 0 0 / .85); display: grid; place-items: center; z-index: 10; cursor: zoom-out; padding: 24px; }
.viewer img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; touch-action: pinch-zoom; }

/* 모바일: 채팅만. 이미지는 썸네일을 탭해 전체 화면으로 */
@media (max-width: 767px) {
  .frame { grid-template-columns: 1fr; }
  .content { display: none; }
  .thumbs img { height: 96px; }
}
</style>
