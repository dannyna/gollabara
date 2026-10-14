<script setup lang="ts">
import type { Artifact } from '../../artifacts'
import { nextTick, onMounted, ref, watch } from 'vue'
import { clock } from '../../artifacts'

const props = defineProps<{
  artifacts: Artifact[]
  selected?: string | null
}>()
const emit = defineEmits<{ select: [key: string], open: [key: string] }>()

const track = ref<HTMLElement>()

function onCellClick(a: Artifact) {
  if (props.selected === a.key)
    emit('open', a.key)
  else
    emit('select', a.key)
}

// Follow latest: the track sticks to the right end. Scrolling back pauses it, and
// new arrivals then raise 「새 산출물 n →」 instead of moving the reader.
const following = ref(true)
const unseen = ref(0)
// Programmatic smooth scrolls pass through "not at the end" too; only a direct
// interaction may pause following
let userIntentUntil = 0
function markUserIntent() {
  userIntentUntil = Date.now() + 800
}
function onScroll() {
  const el = track.value!
  if (el.scrollWidth - el.clientWidth - el.scrollLeft < 70) {
    following.value = true
    unseen.value = 0
  }
  else if (Date.now() < userIntentUntil) {
    following.value = false
  }
}
function jumpToLatest() {
  track.value?.scrollTo({ left: track.value.scrollWidth, behavior: 'smooth' })
  unseen.value = 0
}
watch(() => props.artifacts.length, async (n, prev) => {
  await nextTick()
  if (following.value)
    track.value?.scrollTo({ left: track.value.scrollWidth, behavior: prev ? 'smooth' : 'instant' })
  else if (n > prev)
    unseen.value += n - prev
})
onMounted(() => track.value?.scrollTo({ left: track.value.scrollWidth, behavior: 'instant' }))

/** Brings a cell into view, e.g. when its chat thumbnail is picked */
function reveal(key: string) {
  // Counts as browsing: following pauses unless the cell sits at the right end
  markUserIntent()
  track.value?.querySelector(`[data-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}
defineExpose({ reveal })
</script>

<template>
  <section class="stream-panel" aria-label="산출물 스트림">
    <div class="heading">
      <h2 class="title">
        산출물 스트림
      </h2>
      <span class="hint">산출물을 선택해 피드백을 남겨요</span>
    </div>
    <div
      ref="track" class="track" tabindex="0" aria-label="가로로 스크롤하는 산출물 스트림"
      @scroll.passive="onScroll" @wheel.passive="markUserIntent" @pointerdown="markUserIntent"
      @touchstart.passive="markUserIntent" @keydown="markUserIntent"
    >
      <p v-if="!artifacts.length" class="track-empty">
        아직 산출물이 없어요.
      </p>
      <article
        v-for="a in artifacts" :key="a.key" class="cell"
        :class="{ 'session-start': a.sessionStart, 'selected': selected === a.key }"
        :style="{ '--ratio': a.width / a.height }" :data-key="a.key"
      >
        <div class="meta">
          <strong>{{ a.session }}<span v-if="a.branch" class="muted"> · {{ a.branch }}</span></strong>
          <time>{{ clock(a.at) }} · {{ a.width }} × {{ a.height }}</time>
        </div>
        <button
          class="hit" type="button" :aria-pressed="selected === a.key"
          :aria-label="`${a.session} ${clock(a.at)} 산출물 선택. 다시 누르면 크게 보기`" @click="onCellClick(a)"
        >
          <img :src="a.url" alt="" draggable="false">
        </button>
        <div class="caption">
          <span>{{ a.label }}</span>
          <span class="mono">{{ String(a.seq).padStart(2, '0') }}</span>
        </div>
      </article>
    </div>
    <button v-if="!following && unseen" class="new-pill" type="button" @click="jumpToLatest">
      새 산출물 {{ unseen }} →
    </button>
    <div class="footer">
      <span><i class="dot" />이미지는 원래 비율 그대로</span>
      <span class="mono">{{ following ? '최신 산출물 · 따라가는 중' : '이전 산출물 · 자동 따라가기 일시 정지' }}</span>
    </div>
  </section>
</template>

<style scoped>
.stream-panel {
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* Cells size themselves from the panel height (cqh) */
  container-type: size;
  border-radius: 24px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 21px 26px 17px;
  flex: none;
}
.title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
}
.hint {
  font-size: 11px;
  color: var(--muted);
}
.track {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 22px;
  padding: 0 26px 18px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.track-empty {
  margin: auto;
  color: var(--muted);
  font-size: 12px;
}
.cell {
  flex: none;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* The image ratio sets the width: panel height minus heading, meta, caption, footer */
  width: calc((100cqh - 209px) * var(--ratio));
}
.cell.session-start:not(:first-child) {
  margin-left: 17px;
}
.cell.session-start:not(:first-child)::before {
  content: '';
  position: absolute;
  left: -21px;
  top: 0;
  bottom: 10px;
  border-left: 1px dashed var(--border);
}
.meta {
  height: 48px;
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  white-space: nowrap;
}
.meta strong {
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta time {
  font-size: 10px;
  color: var(--muted);
}
.hit {
  display: block;
  position: relative;
  flex: 1 1;
  min-height: 0;
  width: 100%;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 10px 24px oklch(0 0 0 / 0.2);
}
.hit:hover:not(:disabled) {
  background: var(--surface);
  border-color: var(--muted);
}
.cell.selected .hit,
.cell.selected .hit:hover:not(:disabled) {
  border-color: var(--accent);
}
.hit img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 10px;
}
.caption {
  height: 37px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.caption span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
}
.new-pill {
  position: absolute;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid var(--border);
  border-radius: 40px;
  background: var(--surface);
  box-shadow: 0 5px 24px var(--shade);
  font-size: 12px;
  white-space: nowrap;
}
.footer {
  height: 48px;
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 26px;
  font-size: 10px;
  color: var(--muted);
}
.dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-right: 7px;
  border-radius: 50%;
  background: var(--muted);
}

@media (min-width: 768px) and (max-width: 1023px) {
  .heading {
    padding: 11px 22px 5px;
  }
  .track {
    gap: 18px;
    padding: 0 22px 6px;
  }
  .cell {
    width: calc((100cqh - 128px) * var(--ratio));
  }
  .meta {
    height: 35px;
  }
  .meta strong {
    font-size: 10px;
  }
  .meta time {
    font-size: 9px;
  }
  .caption {
    height: 24px;
    font-size: 9px;
  }
  .footer {
    height: 27px;
    padding: 0 22px;
  }
  .new-pill {
    bottom: 36px;
  }
}

/* Mobile is chat only; chat thumbnails open the viewer instead */
@media (max-width: 767px) {
  .stream-panel {
    display: none;
  }
}
</style>
