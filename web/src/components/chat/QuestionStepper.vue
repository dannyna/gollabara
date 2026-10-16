<script setup lang="ts">
import type { Question } from '../../../../src/shared/types'
import type { QuestionState } from './QuestionCard.vue'
import { computed, nextTick, ref } from 'vue'
import { answerLabel, clampStep, stepName, toChoice } from './chat'
import ChatIcon from './ChatIcon.vue'
import QuestionCard from './QuestionCard.vue'

// A session's AskUserQuestion set in one card, one question at a time (OD guide:
// question-stepper.html, B). Stepping is view state only, never sent or stored. ←/→ belong to
// the stream rail and the viewer, so the card handles no keys: Tab reaches the steps and
// 이전 / 다음, Enter or Space presses them. One question is today's card, without steps.

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
const current = computed(() => props.questions[clampStep(step.value, props.questions.length)]!)
const last = computed(() => props.questions.length - 1)

const prev = ref<HTMLButtonElement>()
const next = ref<HTMLButtonElement>()

function go(to: number) {
  step.value = clampStep(to, props.questions.length)
}
/** 이전 / 다음: when the pressed button turns off at an end, focus moves to the other one */
async function move(delta: -1 | 1) {
  go(step.value + delta)
  await nextTick()
  const pressed = delta < 0 ? prev.value : next.value
  if (pressed?.disabled && document.activeElement === pressed)
    (delta < 0 ? next.value : prev.value)?.focus()
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
  <div v-else class="stepper" role="group" :aria-label="`질문 ${questions.length}개`">
    <div class="eyebrow">
      <ChatIcon name="question" /><b>{{ current.header || '세션에서 물었어요' }}</b>
      <span v-if="current.multiSelect" class="multi">· 여러 개 고르기</span>
      <span class="count">{{ step + 1 }} / {{ questions.length }}</span>
    </div>
    <div class="segments" aria-label="질문 단계">
      <button
        v-for="(q, i) in questions" :key="i" class="segment" :class="{ current: i === step }" type="button"
        :aria-label="stepName(i, q)" :aria-current="i === step ? 'step' : undefined" @click="go(i)"
      >
        <span class="mono">{{ String(i + 1).padStart(2, '0') }}</span>
      </button>
    </div>
    <!-- Every question sits in one cell, so the card keeps the height of the tallest -->
    <div class="stage">
      <div
        v-for="(q, i) in questions" :key="i" class="pane" :class="{ active: i === step }"
        :inert="i !== step || undefined" :aria-hidden="i !== step || undefined"
      >
        <QuestionCard bare :question="q" :state="state" :picks="picks[i]" :inert="inert" />
      </div>
    </div>
    <div class="bottom">
      <button ref="prev" type="button" :disabled="step === 0" @click="move(-1)">
        이전
      </button>
      <button ref="next" type="button" :disabled="step === last" @click="move(1)">
        다음
      </button>
    </div>
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
  margin-bottom: 7px;
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

/* One short bar per question: the current one in fg */
.segments {
  display: flex;
  gap: 7px;
  margin: -2px 0 7px;
}
.segment {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 11px;
  color: var(--muted);
}
.segment::before {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 6px;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
}
.segment.current::before {
  background: var(--fg);
}

.stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.pane {
  grid-area: 1 / 1;
  min-width: 0;
  visibility: hidden;
}
.pane.active {
  visibility: visible;
}

.bottom {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
}
.bottom button {
  min-height: 44px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 11px;
}
.bottom button:disabled {
  opacity: 0.35;
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
