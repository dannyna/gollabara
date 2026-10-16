<script setup lang="ts">
import type { Question } from '../../../../src/shared/types'
import type { QuestionState } from './QuestionCard.vue'
import { computed, nextTick, ref } from 'vue'
import { answerLabel, clampStep, stepNav, toChoice } from './chat'
import ChatIcon from './ChatIcon.vue'
import QuestionCard from './QuestionCard.vue'

// A session's AskUserQuestion set in one card, one question at a time (OD guide:
// question-card-v3.html, 5). The current question is a page in front; the next one peeks out on
// its right edge as one button that brings it forward, and 「앞 문항」 under the options steps
// back. The options are read-only rows: answering is not built, so only stepping can be pressed.
// Stepping is view state only, never sent or stored. ←/→ belong to the stream rail and the
// viewer, so the card handles no keys: Tab reaches the buttons, Enter or Space presses them.
// One question is today's card, without steps.

const props = withDefaults(defineProps<{
  questions: Question[]
  state?: QuestionState
  /** Picked option indexes per question, for the terminal summary */
  picks?: number[][]
  inert?: boolean
  /** The step shown first; the gallery uses it, the app always starts at the first question */
  start?: number
}>(), { state: 'open', picks: () => [], start: 0 })

const step = ref(clampStep(props.start, props.questions.length))
const nav = computed(() => stepNav(props.questions, step.value))
const current = computed(() => props.questions[nav.value.step]!)

const panes = computed(() => props.questions.map(q => ({ question: q, options: q.options.map(toChoice) })))

const root = ref<HTMLElement>()
/**
 * A pressed button that goes away (the peek on the last question) or turns disabled (앞 문항 on
 * the first) hands focus to the other control, but only if it had focus
 */
async function go(to: number, event: MouseEvent) {
  const pressed = event.currentTarget as HTMLButtonElement
  const focused = document.activeElement === pressed
  step.value = clampStep(to, props.questions.length)
  await nextTick()
  if (focused && (!pressed.isConnected || pressed.disabled))
    root.value?.querySelector<HTMLElement>('.peek, .back:not(:disabled)')?.focus()
}

// Answered in the terminal: each header with the picked answer, or the card's own copy when unknown
const summary = computed(() => props.questions.map((q, i) => ({
  header: q.header || `질문 ${i + 1}`,
  answer: answerLabel(q.options.map(toChoice), props.picks[i] ?? []) || '터미널에서 답했어요',
})))
</script>

<template>
  <QuestionCard
    v-if="questions.length === 1" :question="questions[0]!" :state="state" :picks="picks[0]" :inert="inert"
  />
  <div v-else-if="state === 'terminal'" class="stepper summary">
    <div class="summary-head">
      <ChatIcon name="term" />터미널에서 모두 답했어요
    </div>
    <dl>
      <template v-for="(row, i) in summary" :key="i">
        <dt>{{ row.header }}</dt>
        <dd>{{ row.answer }}</dd>
      </template>
    </dl>
  </div>
  <div v-else ref="root" class="pages" role="group" :aria-label="`질문 ${questions.length}개`">
    <div class="page">
      <div class="head">
        <ChatIcon name="question" /><b>{{ current.header || '세션에서 물었어요' }}</b>
        <span v-if="current.multiSelect" class="multi">· 여러 개 고르기</span>
      </div>
      <!-- Every question sits in one cell, so the card keeps the height of the tallest -->
      <div class="stage">
        <div
          v-for="(p, i) in panes" :key="i" class="pane" :class="{ active: i === nav.step }"
          :inert="i !== nav.step || undefined" :aria-hidden="i !== nav.step || undefined"
        >
          <p>{{ p.question.question }}</p>
          <ul class="options" :aria-label="`${p.question.header || `질문 ${i + 1}`} 선택지, 읽기 전용`">
            <li v-for="(o, j) in p.options" :key="j">
              <span class="number" aria-hidden="true">{{ j + 1 }}</span>
              <div>
                <span class="label">{{ o.label }}</span><span v-if="o.recommended" class="rec">추천</span>
                <span v-if="o.description" class="description">{{ o.description }}</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <button
        class="back" type="button" :disabled="nav.previous === undefined"
        @click="nav.previous !== undefined && go(nav.previous, $event)"
      >
        <ChatIcon name="previous" />앞 문항
      </button>
      <p class="notice">
        앱에서 답하기는 준비 중이에요 · 터미널에서 답해 주세요
      </p>
      <span class="sr-only" role="status" aria-live="polite">{{ nav.step + 1 }}번째 질문 · {{ current.header || '세션에서 물었어요' }}</span>
    </div>
    <button
      v-if="nav.next" class="peek" type="button" :aria-label="`다음 질문 보기 · ${nav.next.label}`"
      @click="go(nav.next.step, $event)"
    >
      <span class="number">{{ nav.next.number }}</span>
      <span class="title">다음 질문</span>
      <ChatIcon name="next" />
    </button>
  </div>
</template>

<style scoped>
.stepper,
.pages {
  margin-top: 9px;
}
.stepper {
  padding: 16px;
  border-radius: 16px;
  background: var(--bg);
}

/* The current page in front; the right gutter stays on every step, so the page's width (and so
   its height) never changes, even on the last question where nothing peeks */
.pages {
  position: relative;
  isolation: isolate;
  padding-right: 45px;
}
.page {
  position: relative;
  z-index: 1;
  min-width: 0;
  padding: 14px;
  border-radius: 16px;
  background: var(--bg);
  box-shadow: 5px 0 10px var(--shade);
  line-height: 1.65;
}
.head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  margin-bottom: 8px;
  font-size: 11px;
  white-space: nowrap;
}
.head .chat-icon {
  width: 16px;
  height: 16px;
}
/* One line, so a long header never changes the card's height */
.head b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.head .multi {
  font-size: 10px;
  color: var(--muted);
}

.stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.pane {
  grid-area: 1 / 1;
  align-self: start;
  min-width: 0;
  visibility: hidden;
}
.pane.active {
  visibility: visible;
}
.pane p {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.75;
}

/* Read-only rows: a boxed number, the label, the description under it. Nothing looks pressable. */
.options {
  display: grid;
  gap: 11px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}
.options li {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.options .number {
  display: grid;
  place-items: center;
  flex: none;
  min-width: 18px;
  height: 18px;
  margin-top: 2px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font: 10px var(--mono);
  color: var(--muted);
}
.label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.6;
  color: var(--muted);
}
.rec {
  margin-left: 6px;
  font-size: 10px;
  color: var(--muted);
}
.description {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  line-height: 1.65;
  letter-spacing: 0.01em;
  color: var(--muted);
}

.back {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 5px 0 -5px;
  padding: 0 7px 0 0;
  border-radius: 7px;
  font-size: 11px;
}
.back .chat-icon {
  width: 16px;
  height: 16px;
}
.back:disabled {
  opacity: 0.3;
}
.back:hover:not(:disabled) {
  background: none;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.notice {
  margin-top: 14px;
  font-size: 10px;
  line-height: 1.7;
  letter-spacing: 0.01em;
  color: var(--muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* The next question's page behind the current one: its edge is one button */
.peek {
  position: absolute;
  top: 18px;
  right: 0;
  bottom: 18px;
  width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 0;
  border: 1px solid var(--border);
  border-radius: 0 12px 12px 0;
  background: var(--bg);
}
.peek:hover:not(:disabled) {
  background: var(--bg);
  border-color: var(--muted);
}
.peek .number {
  font: 11px var(--mono);
  color: var(--muted);
}
.peek .title {
  writing-mode: vertical-rl;
  font-size: 11px;
  letter-spacing: 0.1em;
}
.peek .chat-icon {
  width: 16px;
  height: 16px;
}

/* Answered in the terminal: headers and picks, all muted */
.summary {
  color: var(--muted);
}
.summary-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 11px;
}
.summary-head .chat-icon {
  width: 13px;
  height: 13px;
}
.summary dl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px 14px;
  margin: 0;
  font-size: 11px;
}
.summary dt,
.summary dd {
  margin: 0;
}

@media (max-width: 767px) {
  .stepper {
    padding: 14px;
  }
}
</style>
