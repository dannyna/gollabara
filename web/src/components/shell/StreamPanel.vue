<script setup lang="ts">
// Desktop's left work surface and tablet's top band (OD stream guide): heading, rail,
// footer. It follows the latest artifact while the rail sits at the right end and holds
// its place once the reader scrolls back, raising 「새 산출물 n →」 instead. A pinned cell
// stops following altogether: arrivals only raise the pill, wherever the rail sits.
// Moving the rail sideways (wheel, arrows, a swipe) lets go of the pin.
// References fold into 「참고 이미지 n」 between the cells and never count as arrivals.
// History (#77): reaching the start loads older cells, and a run the reader jumped to loads newer
// ones at its end; either keeps the view in place. Such a run never follows: arrivals wait on the
// server's side, the pill counts them, and it leads back to the latest.

import type { Artifact } from '../../artifacts'
import type { Guide } from '../../firstrun'
import type { HistoryState } from '../../history'
import type { Follow } from '../stream/follow'
import { computed, nextTick, ref, watch } from 'vue'
import { referenceFolds } from '../../artifacts'
import NewPill from '../banner/NewPill.vue'
import StateView from '../banner/StateView.vue'
import { feedbackTargetOf, useFeedbackTarget } from '../overlay/useFeedbackTarget'
import { activePin, arrivedSince, atLatest, holdKey, lastArrival, latestLeft, listMove, togglePin } from '../stream/follow'
import StreamFooter from '../stream/StreamFooter.vue'
import StreamRail from '../stream/StreamRail.vue'
import HarnessGuide from './HarnessGuide.vue'

const props = defineProps<{
  artifacts: Artifact[]
  /** Images the sessions only looked at (toArtifacts with 'reference'), folded between the cells */
  references?: Artifact[]
  selected?: string | null
  /** The pinned cell's key; it holds nothing while its cell is not in `artifacts` */
  pinned?: string | null
  /** Session in view, or null for every session */
  scope?: string | null
  /** Every session is muted: the empty view points back to the session menu */
  allMuted?: boolean
  /** Sessions that ended, faded on the rail */
  ended?: ReadonlySet<string>
  /** Gallery: open scrolled back to the start with this many arrivals waiting */
  preview?: { unseen: number }
  /** Connected harnesses and the next step, for the empty view; null until the server's health answered */
  guide?: Guide | null
  /** The run of messages in view (useStream); without it the rail is live with nothing older */
  history?: HistoryState
}>()
const emit = defineEmits<{ select: [key: string], open: [key: string], pin: [key: string | null], sessions: [], older: [], newer: [], latest: [] }>()

const live = computed(() => props.history?.live ?? true)
/** How close to either end of the rail a page starts loading, in px */
const PAGE_EDGE = 400

const folds = computed(() => referenceFolds(props.artifacts, props.references ?? []))
const rail = ref<InstanceType<typeof StreamRail>>()
const track = computed(() => rail.value?.el)

const keysOf = (list: Artifact[]) => new Set(list.map(a => a.key))
const pin = computed(() => activePin(props.pinned, keysOf(props.artifacts)))

/** A click on a cell selects it and pins it, or unpins it when it was the pinned one */
function onSelect(key: string) {
  emit('pin', togglePin(props.pinned ?? null, key))
  emit('select', key)
}

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
/** How following resumes once a move lets go of the pin; the rail may still be on its way there */
let unpinTo: Follow | undefined
/** Moving the rail by hand lets go of the pin: the reader has left the cell it held */
function letGo(to: Follow) {
  if (!props.pinned)
    return
  unpinTo = to
  emit('pin', null)
}
/** A step pauses following up front unless it lands on the latest, so a cell arriving mid-step cannot pull the rail back */
function onStep(left: number) {
  markUserIntent()
  const el = track.value!
  const latest = atLatest({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollLeft: left }, rail.value?.latestAlign())
  letGo(latest ? 'following' : 'paused')
  if (!latest)
    follow.value = 'paused'
}
/** A sideways swipe on a touch screen moves the rail natively, so it lets go here */
let touchStart: { x: number, y: number } | undefined
function onTouchStart(e: TouchEvent) {
  markUserIntent()
  touchStart = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }
}
function onTouchMove(e: TouchEvent) {
  if (!touchStart)
    return
  const dx = Math.abs(e.touches[0]!.clientX - touchStart.x)
  if (dx > 10 && dx > Math.abs(e.touches[0]!.clientY - touchStart.y)) {
    touchStart = undefined
    letGo('paused')
  }
}
/** More than two widths back from the latest: 「최신으로 →」 shows even with nothing new */
const far = ref(false)
/** Loads a page when the reader is at an end; only on their own scroll, so a rail of few cells never pulls in all history */
function maybeLoad() {
  const el = track.value
  const h = props.history
  if (!el || !h || h.loading || Date.now() >= userIntentUntil)
    return
  if (h.older && el.scrollLeft < PAGE_EDGE)
    emit('older')
  else if (!h.live && el.scrollWidth - el.clientWidth - el.scrollLeft < PAGE_EDGE)
    emit('newer')
}
function onIntent() {
  markUserIntent()
  maybeLoad()
}
function measureFar() {
  const el = track.value
  if (el)
    far.value = latestLeft(el.scrollWidth - el.clientWidth, rail.value?.latestAlign()) - el.scrollLeft > 2 * el.clientWidth
}
function onScroll() {
  const el = track.value!
  measureFar()
  maybeLoad()
  if (!live.value) {
    // A run that does not reach the latest has nothing to follow
    if (Date.now() < userIntentUntil)
      follow.value = 'paused'
    return
  }
  if (atLatest(el, rail.value?.latestAlign())) {
    // A pin keeps the rail from following even at the right end
    if (!pin.value)
      follow.value = 'following'
    unseen.value = 0
  }
  else if (Date.now() < userIntentUntil) {
    follow.value = 'paused'
  }
}
/** The right end, or the latest cell on the anchor when a trailing 「참고 이미지」 fold would push it out */
function toLatest(behavior: ScrollBehavior) {
  const el = track.value
  el?.scrollTo({ left: latestLeft(el.scrollWidth - el.clientWidth, rail.value?.latestAlign()), behavior })
}
function jumpToLatest() {
  // A run the reader jumped to is replaced by the latest one; App lets go of the pin
  if (!live.value) {
    emit('latest')
    return
  }
  // The way back to the latest also lets go of the pin, so following resumes
  if (props.pinned)
    emit('pin', null)
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
 * The cell to hold and where it sits: `prefer` (the pin) when given, else the first cell
 * in view that a new capture will not move. Read before the DOM updates: a re-captured
 * screen moves its cell to the end, and the cells after its old place close up under a
 * reader who is browsing.
 */
function holdView(moved: Set<string>, prefer: string | null) {
  const el = track.value
  if (!el)
    return null
  const left = el.getBoundingClientRect().left
  const pinned = prefer && el.querySelector<HTMLElement>(`:scope > [data-key="${CSS.escape(prefer)}"]`)
  if (pinned)
    return { key: prefer, offset: pinned.getBoundingClientRect().left - left }
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

/** Pages and landings already handled, so the list watch tells them from arrivals */
let pagesSeen = props.history?.pages ?? 0
let landSeen = props.history?.land.epoch ?? 0

/** A jump or 「최신으로」 lands on the day's first cell, or on the latest */
function land(day: number | null) {
  unseen.value = 0
  if (day == null) {
    follow.value = pin.value ? 'paused' : 'following'
    toLatest('instant')
    return
  }
  follow.value = 'paused'
  const cell = props.artifacts.find(a => a.at >= day)
  if (cell)
    rail.value?.align(cell.key, 'instant')
  else
    toLatest('instant')
}
watch(() => props.history?.land, (next) => {
  if (next && next.epoch !== landSeen) {
    landSeen = next.epoch
    land(next.day)
    // A landing need not fire a scroll event, so the pill would keep the old run's distance
    requestAnimationFrame(measureFar)
  }
}, { flush: 'post' })

watch([() => props.artifacts, () => props.scope], async ([list, scope], [prevList, prevScope]) => {
  // A page renumbers arrivals (they rank the loaded captures): count from here, and keep the view
  const paged = (props.history?.pages ?? 0) !== pagesSeen
  pagesSeen = props.history?.pages ?? 0
  if (paged || (props.history?.land.epoch ?? 0) !== landSeen) {
    seen = lastArrival(list)
    const hold = paged ? holdView(new Set(), activePin(props.pinned, keysOf(list))) : null
    await nextTick()
    if (hold)
      restoreView(hold)
    return
  }
  const arrived = arrivedSince(seen, list)
  const now = keysOf(list)
  const pinNow = activePin(props.pinned, now)
  const moved = new Set(list.filter(a => a.arrival > seen).map(a => a.key))
  const hold = arrived && (follow.value === 'paused' || pinNow) ? holdView(moved, holdKey(pinNow, moved)) : null
  seen = Math.max(seen, lastArrival(list))
  // Cells that only appeared or vanished: a session muted or unmuted
  const before = keysOf(prevList)
  const reshuffled = prevList.some(a => !now.has(a.key)) || list.some(a => !before.has(a.key) && a.arrival <= lastArrival(prevList))
  await nextTick()
  const scopeChanged = scope !== prevScope
  const next = listMove({ scopeChanged, reshuffled, arrived, follow: follow.value, pin: pinNow, selected: props.selected ?? null, keys: now })
  if (scopeChanged) {
    // A new scope starts at its latest artifact, or on the pin when it is in that scope
    follow.value = pinNow ? 'paused' : 'following'
    unseen.value = 0
    if (next.move === 'reveal')
      rail.value?.align(next.key, 'instant')
    else
      toLatest('instant')
  }
  else if (next.move === 'reveal') {
    reveal(next.key, 'instant')
  }
  else if (next.move === 'latest') {
    toLatest('smooth')
  }
  else if (next.move === 'hold') {
    // Holding the view by setting scrollLeft would cut a step's smooth scroll short
    if (!rail.value?.realign())
      restoreView(hold)
    unseen.value += arrived
  }
})

// Pinning stops following; letting go follows again only from the right end
watch(() => props.pinned, () => {
  const to = unpinTo
  unpinTo = undefined
  if (pin.value)
    follow.value = 'paused'
  else if (to)
    follow.value = to
  else if (track.value)
    follow.value = atLatest(track.value, rail.value?.latestAlign()) ? 'following' : 'paused'
})

// The rail mounts at the latest, also when the first artifact ends an empty state, or on
// the pin restored from the last visit
watch(track, (el) => {
  if (!el)
    return
  if (props.preview) {
    follow.value = 'paused'
    unseen.value = props.preview.unseen
    if (pin.value)
      rail.value?.align(pin.value, 'instant')
  }
  else if (pin.value) {
    follow.value = 'paused'
    rail.value?.align(pin.value, 'instant')
  }
  else if (!live.value) {
    // The first cells of a run the reader jumped to (the scope had none before)
    land(props.history!.land.day)
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
    <!-- With only references in view the rail still shows, so their folds can open -->
    <StateView v-else-if="!artifacts.length && !folds.length" :title="scope != null ? '이 세션에는 아직 산출물이 없어요.' : '아직 산출물이 없어요.'">
      <HarnessGuide v-if="guide" :guide="guide" place="stream" />
    </StateView>
    <StreamRail
      v-else ref="rail" :artifacts="artifacts" :folds="folds" :selected="selected" :pinned="pin" :ended="ended"
      @select="onSelect" @open="emit('open', $event)" @reply="setTarget(feedbackTargetOf($event))"
      @step="onStep" @scroll.passive="onScroll" @wheel.passive="onIntent" @pointerdown="markUserIntent"
      @touchstart.passive="onTouchStart" @touchmove.passive="onTouchMove" @keydown="onIntent"
    />
    <!-- Arrivals, a run the reader jumped to, or far back in a long one: each way back is the pill -->
    <NewPill
      v-if="artifacts.length && (!live || (follow === 'paused' && unseen) || far)" kind="artifact"
      :count="live ? unseen : history!.behind.artifacts" @click="jumpToLatest"
    />
    <StreamFooter :follow="follow" :pinned="!!pin" :history="!live" />
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
