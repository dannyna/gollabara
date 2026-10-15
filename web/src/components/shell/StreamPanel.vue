<script setup lang="ts">
// Desktop's left work surface and tablet's top band (OD stream guide): heading, rail,
// footer. It follows the latest artifact while the rail sits at the right end and holds
// its place once the reader scrolls back, raising 「새 산출물 n →」 instead.

import type { Artifact } from '../../artifacts'
import type { Follow } from '../stream/follow'
import { computed, nextTick, ref, watch } from 'vue'
import NewPill from '../banner/NewPill.vue'
import StateView from '../banner/StateView.vue'
import { feedbackTargetOf, useFeedbackTarget } from '../overlay/useFeedbackTarget'
import { arrivedSince, atLatest, lastArrival } from '../stream/follow'
import StreamFooter from '../stream/StreamFooter.vue'
import StreamRail from '../stream/StreamRail.vue'

const props = defineProps<{
  artifacts: Artifact[]
  selected?: string | null
  /** Session in view, or null for every session */
  scope?: string | null
  /** Every session is muted: the empty view points back to the session menu */
  allMuted?: boolean
  /** Gallery: open scrolled back to the start with this many arrivals waiting */
  preview?: { unseen: number }
}>()
const emit = defineEmits<{ select: [key: string], open: [key: string], sessions: [] }>()

const rail = ref<InstanceType<typeof StreamRail>>()
const track = computed(() => rail.value?.el)

const follow = ref<Follow>('start')
const unseen = ref(0)
// Newest arrival already accounted for, so only real arrivals are counted
let seen = lastArrival(props.artifacts)

// Programmatic smooth scrolls pass through "not at the end" too; only a direct
// interaction may pause following. A wheel step scrolls smoothly for a while, so the
// intent outlasts it.
let userIntentUntil = 0
function markUserIntent() {
  userIntentUntil = Date.now() + 1000
}
/** A step pauses following up front unless it lands on the latest, so a cell arriving mid-step cannot pull the rail back */
function onStep(left: number) {
  markUserIntent()
  const el = track.value!
  if (!atLatest({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollLeft: left }))
    follow.value = 'paused'
}
function onScroll() {
  const el = track.value!
  if (atLatest(el)) {
    follow.value = 'following'
    unseen.value = 0
  }
  else if (Date.now() < userIntentUntil) {
    follow.value = 'paused'
  }
}
function toLatest(behavior: ScrollBehavior) {
  track.value?.scrollTo({ left: track.value.scrollWidth, behavior })
}
function jumpToLatest() {
  toLatest('smooth')
  // The pill goes away, so focus lands on the track it led back to
  track.value?.focus({ preventScroll: true })
  unseen.value = 0
}

/** Puts a cell on the rail's anchor, like a wheel step, e.g. when its chat thumbnail is picked */
function reveal(key: string, behavior?: ScrollBehavior) {
  // Counts as browsing: following pauses unless the cell sits at the right end
  markUserIntent()
  rail.value?.align(key, behavior)
}
defineExpose({ reveal })

/**
 * The first cell in view that a new capture will not move, and where it sits. Read before
 * the DOM updates: a re-captured screen moves its cell to the end, and the cells after its
 * old place close up under a reader who is browsing.
 */
function holdView(moved: Set<string>) {
  const el = track.value
  if (!el)
    return null
  const left = el.getBoundingClientRect().left
  for (const cell of el.querySelectorAll<HTMLElement>(':scope > [data-key]')) {
    const box = cell.getBoundingClientRect()
    if (box.right > left && !moved.has(cell.dataset.key!))
      return { key: cell.dataset.key!, offset: box.left - left }
  }
  return null
}
function restoreView(hold: { key: string, offset: number } | null) {
  const el = track.value
  const cell = hold && el?.querySelector<HTMLElement>(`:scope > [data-key="${CSS.escape(hold.key)}"]`)
  if (el && cell)
    el.scrollLeft += cell.getBoundingClientRect().left - el.getBoundingClientRect().left - hold!.offset
}

watch([() => props.artifacts, () => props.scope], async ([list, scope], [prevList, prevScope]) => {
  const arrived = arrivedSince(seen, list)
  const hold = arrived && follow.value === 'paused' ? holdView(new Set(list.filter(a => a.arrival > seen).map(a => a.key))) : null
  seen = Math.max(seen, lastArrival(list))
  // Cells that only appeared or vanished: a session muted or unmuted
  const before = new Set(prevList.map(a => a.key))
  const now = new Set(list.map(a => a.key))
  const reshuffled = prevList.some(a => !now.has(a.key)) || list.some(a => !before.has(a.key) && a.arrival <= lastArrival(prevList))
  await nextTick()
  if (scope !== prevScope) {
    // A new scope starts at its latest artifact
    follow.value = 'following'
    unseen.value = 0
    toLatest('instant')
  }
  else if (reshuffled && props.selected && list.some(a => a.key === props.selected)) {
    // Muting keeps the reader on the cell they picked
    reveal(props.selected, 'instant')
  }
  else if (arrived && follow.value !== 'paused') {
    toLatest('smooth')
  }
  else if (arrived) {
    // Holding the view by setting scrollLeft would cut a step's smooth scroll short
    if (!rail.value?.realign())
      restoreView(hold)
    unseen.value += arrived
  }
})

// The rail mounts at the latest, also when the first artifact ends an empty state
watch(track, (el) => {
  if (!el)
    return
  if (props.preview) {
    follow.value = 'paused'
    unseen.value = props.preview.unseen
  }
  else {
    toLatest('instant')
  }
}, { flush: 'post' })

const { setTarget } = useFeedbackTarget()
</script>

<template>
  <section class="stream-panel" aria-label="산출물 스트림">
    <div class="heading">
      <h2 class="title">
        산출물 스트림
      </h2>
      <span class="hint">산출물을 선택해 피드백을 남겨요</span>
    </div>
    <StateView
      v-if="!artifacts.length && allMuted" icon="mute" title="모든 세션을 음소거했어요"
      description="세션 목록에서 다시 표시할 수 있어요." action="세션 목록 열기" @action="emit('sessions')"
    />
    <StateView v-else-if="!artifacts.length" :title="scope != null ? '이 세션에는 아직 산출물이 없어요.' : '아직 산출물이 없어요.'" />
    <StreamRail
      v-else ref="rail" :artifacts="artifacts" :selected="selected"
      @select="emit('select', $event)" @open="emit('open', $event)" @reply="setTarget(feedbackTargetOf($event))"
      @step="onStep" @scroll.passive="onScroll" @wheel.passive="markUserIntent" @pointerdown="markUserIntent"
      @touchstart.passive="markUserIntent" @keydown="markUserIntent"
    />
    <NewPill v-if="follow === 'paused' && unseen && artifacts.length" kind="artifact" :count="unseen" @click="jumpToLatest" />
    <StreamFooter :follow="follow" />
  </section>
</template>

<style scoped>
.stream-panel {
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* Cells size themselves from the panel height (cqh): heading 58 + meta 48 +
     caption 37 + rail padding 18 + footer 48 = 209 around the image face */
  container-type: size;
  --stream-chrome: 209px;
  --stream-inset: 52px;
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

/* Tablet: 36 + 35 + 24 + 6 + 27 = 128 */
@media (min-width: 768px) and (max-width: 1023px) {
  .stream-panel {
    --stream-chrome: 128px;
    --stream-inset: 44px;
  }
  .heading {
    padding: 11px 22px 5px;
  }
}

/* Mobile is chat only; chat thumbnails open the viewer instead */
@media (max-width: 767px) {
  .stream-panel {
    display: none;
  }
}
</style>
