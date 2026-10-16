<script setup lang="ts">
import type { Question } from '../../../../src/shared/types'
import type { QuestionState } from './QuestionCard.vue'
import { computed, nextTick, ref } from 'vue'
import { answerLabel, choiceLayout, clampStep, stepNav, toChoice } from './chat'
import ChatIcon from './ChatIcon.vue'
import QuestionCard from './QuestionCard.vue'

// A session's AskUserQuestion set in one card, one question at a time (OD guide:
// question-stepper-v2.html, E). The options are read-only rows: answering is not built, so only
// stepping can be pressed. Progress dots and 「이전 질문」 sit under the eyebrow, and 「다음 · header」
// right under the options. Stepping is view state only, never sent or stored. ←/→ belong to the
// stream rail and the viewer, so the card handles no keys: Tab reaches the buttons, Enter or Space
// presses them. One question is today's card, without steps.

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

const panes = computed(() => props.questions.map((q, i) => {
  const options = q.options.map(toChoice)
  return { question: q, options, short: choiceLayout(options) === 'short', next: stepNav(props.questions, i).next }
}))

const root = ref<HTMLElement>()
/** A pressed button that the step hides or removes hands focus to the current dot */
async function go(to: number, event: MouseEvent) {
  const pressed = event.currentTarget as HTMLElement
  const focused = document.activeElement === pressed
  step.value = clampStep(to, props.questions.length)
  await nextTick()
  if (focused && (!pressed.isConnected || pressed.closest('[inert]')))
    root.value?.querySelector<HTMLElement>('.dot[aria-current]')?.focus()
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
  <div v-else ref="root" class="stepper" role="group" :aria-label="`질문 ${questions.length}개`">
    <div class="eyebrow">
      <ChatIcon name="question" /><b>{{ current.header || '세션에서 물었어요' }}</b>
      <span v-if="current.multiSelect" class="multi">· 여러 개 고르기</span>
      <span class="count">{{ nav.step + 1 }} / {{ questions.length }}</span>
    </div>
    <div class="dots">
      <button
        v-for="d in nav.dots" :key="d.step" class="dot" type="button" :aria-label="d.label"
        :aria-current="d.current ? 'step' : undefined" @click="go(d.step, $event)"
      >
        <span aria-hidden="true" />
      </button>
      <button v-if="nav.previous !== undefined" class="back" type="button" @click="go(nav.previous, $event)">
        이전 질문
      </button>
      <span v-else class="first">첫 질문</span>
    </div>
    <!-- Every question sits in one cell, so the card keeps the height of the tallest -->
    <div class="stage">
      <div
        v-for="(p, i) in panes" :key="i" class="pane" :class="{ active: i === nav.step }"
        :inert="i !== nav.step || undefined" :aria-hidden="i !== nav.step || undefined"
      >
        <p>{{ p.question.question }}</p>
        <ul class="options" :class="{ short: p.short }" :aria-label="`${p.question.header || `질문 ${i + 1}`} 선택지, 읽기 전용`">
          <li v-for="(o, j) in p.options" :key="j">
            <div>
              <span class="label">{{ o.label }}</span><span v-if="o.recommended" class="rec">추천</span>
              <span v-if="o.description" class="description">{{ o.description }}</span>
            </div>
          </li>
        </ul>
        <button v-if="p.next" class="next" type="button" @click="go(p.next.step, $event)">
          <span><small>다음 ·</small><b>{{ p.next.header }}</b></span>
          <ChatIcon name="next" />
        </button>
        <div v-else class="last">
          마지막 질문이에요
        </div>
      </div>
    </div>
    <p class="notice">
      앱에서 답하기는 준비 중이에요 · 터미널에서 답해 주세요
    </p>
    <span class="sr-only" role="status" aria-live="polite">{{ nav.step + 1 }}번째 질문 · {{ current.header || '세션에서 물었어요' }}</span>
  </div>
</template>

<style scoped>
.stepper {
  margin-top: 9px;
  padding: 16px;
  border-radius: 16px;
  background: var(--bg);
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  margin-bottom: 10px;
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
}
.eyebrow .chat-icon {
  width: 13px;
  height: 13px;
}
.eyebrow b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--fg);
  font-weight: 600;
}
.eyebrow .count {
  margin-left: auto;
  font-family: var(--mono);
}

/* Quiet progress: a 4px dot per question, the current one a short bar, each in a 44px target */
.dots {
  display: flex;
  align-items: center;
  margin: -10px -6px -2px 0;
}
.dot {
  width: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  border-radius: 7px;
}
.dot span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--muted);
}
.dot[aria-current] span {
  width: 16px;
  height: 3px;
  border-radius: 4px;
  background: var(--fg);
}
.dot:hover:not(:disabled) {
  background: none;
}
.dot:hover span {
  box-shadow: 0 0 0 2px var(--border);
}
.back {
  margin-left: auto;
  min-height: 44px;
  padding: 0 6px;
  border-radius: 7px;
  font-size: 11px;
}
.first {
  margin-left: auto;
  padding-right: 6px;
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
  font-size: 12px;
  line-height: 1.7;
}

/* Read-only rows: a dash, the label, the description under it. Nothing here looks pressable. */
.options {
  display: grid;
  gap: 9px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.options li {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: 7px;
}
.options li::before {
  content: '–';
  font-size: 11px;
  color: var(--muted);
}
.options.short {
  display: flex;
  flex-wrap: wrap;
  gap: 9px 24px;
}
.label {
  font-size: 12px;
  line-height: 1.5;
}
.rec {
  margin-left: 7px;
  font-size: 10px;
  color: var(--muted);
}
.description {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}

/* 「다음 · header」 right under the options, so a short question never pushes it down */
.next {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  border-radius: 7px;
  font-size: 11px;
  text-align: left;
}
.next span {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
}
.next small {
  font-size: 10px;
  color: var(--muted);
}
.next b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.next .chat-icon {
  width: 13px;
  height: 13px;
}
.back:hover:not(:disabled),
.next:hover:not(:disabled) {
  background: none;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.last {
  min-height: 44px;
  display: flex;
  align-items: center;
  margin-top: 6px;
  font-size: 11px;
  color: var(--muted);
}
.notice {
  margin-top: 12px;
  font-size: 11px;
  line-height: 1.6;
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
