<script setup lang="ts">
import type { Question } from '../../../../src/shared/types'
import type { AnswerFailure, Draft } from '../../answers'
import type { QuestionState } from './QuestionCard.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { ANSWER_MAX } from '../../../../src/shared/answer'
import { draftAnswers, FAILURE_NOTE, holdNote } from '../../answers'
import { clock } from '../../artifacts'
import { answerLabel, clampStep, stepName, stepNav, toChoice } from './chat'
import ChatIcon from './ChatIcon.vue'
import QuestionCard from './QuestionCard.vue'

// A session's AskUserQuestion set in one card, one question at a time (OD guide:
// question-card-v3.html, 5). The current question fills the card, and an indicator at its foot steps
// through the set: ‹, one dot per question, ›. Read-only, the options are plain rows. While the session's
// hook holds the set (not inert), they become buttons: a single choice records and steps on, a
// multiSelect toggles, 「직접 답하기」 types an answer, and the last page sends every answer at once.
// Stepping is view state only, never sent or stored. ←/→ belong to the stream rail and the
// viewer, so the card handles no keys: Tab reaches the buttons, Enter or Space presses them.
// One question is today's card, without steps.

const props = withDefaults(defineProps<{
  questions: Question[]
  state?: QuestionState
  /** Picked option indexes per question: the answers once sent or answered, or a draft in the gallery */
  picks?: number[][]
  /** Free-text answers per question, where the answer is no label */
  texts?: (string | undefined)[]
  inert?: boolean
  /** The step shown first; the gallery uses it, the app always starts at the first question */
  start?: number
  answeredAt?: number
  /** While held: when the hold ends, and the clock the countdown reads */
  until?: number
  now?: number
  failure?: AnswerFailure
  retry?: boolean
}>(), { state: 'open', picks: () => [], texts: () => [], start: 0, failure: 'network' })

const emit = defineEmits<{
  /** Every answer, keyed by question text */
  send: [answers: Record<string, string>]
  retry: []
}>()

const step = ref(clampStep(props.start, props.questions.length))
const nav = computed(() => stepNav(props.questions, step.value))
const current = computed(() => props.questions[nav.value.step]!)

const panes = computed(() => props.questions.map(q => ({ question: q, options: q.options.map(toChoice) })))

/** Answering here: held, and not sent yet (or sent and failed, with time to retry) */
const live = computed(() => !props.inert && (props.state === 'open' || props.state === 'fail'))
const drafts = ref<Draft[]>([])
function resetDrafts() {
  drafts.value = props.questions.map((_, i) => ({ picks: [...(props.picks[i] ?? [])], text: props.texts[i] }))
}
resetDrafts()
// By value: the parent hands new arrays on every countdown tick, which must not drop the draft
watch(() => JSON.stringify([props.picks, props.texts]), resetDrafts)
const result = computed(() => draftAnswers(props.questions, drafts.value))
const countdown = computed(() => live.value && props.until != null && props.now != null ? holdNote(props.until, props.now) : undefined)

const root = ref<HTMLElement>()
const summaryEl = ref<HTMLElement>()
// 「n개 답 보내기」 swaps the pages for the summary, and a failure swaps them back, which would drop focus to
// the page: the new card takes it instead, if it was inside the old one
watch(() => props.state, async () => {
  if (!(root.value ?? summaryEl.value)?.contains(document.activeElement))
    return
  await nextTick()
  const card = root.value ?? summaryEl.value
  if (card && !card.contains(document.activeElement))
    card.focus({ preventScroll: true })
}, { flush: 'pre' })
/** An arrow that turns disabled (on the first or last question) hands focus to the other one, if it had focus */
async function go(to: number, event: MouseEvent) {
  const pressed = event.currentTarget as HTMLButtonElement
  const focused = document.activeElement === pressed
  step.value = clampStep(to, props.questions.length)
  await nextTick()
  if (focused && pressed.disabled)
    root.value?.querySelector<HTMLElement>('.arrow:not(:disabled)')?.focus()
}

/** The pressed option sits in a pane that turns inert, so focus follows to the next question's first control */
async function stepOn(from: number) {
  if (from >= props.questions.length - 1)
    return
  step.value = from + 1
  await nextTick()
  root.value?.querySelector<HTMLElement>('.pane.active .pick, .pane.active textarea')?.focus()
}

function pick(i: number, j: number) {
  if (!live.value)
    return
  const d = drafts.value[i]!
  if (props.questions[i]!.multiSelect) {
    d.picks = d.picks.includes(j) ? d.picks.filter(x => x !== j) : [...d.picks, j]
    return
  }
  d.picks = [j]
  stepOn(i)
}
async function typeAnswer(i: number, on: boolean) {
  drafts.value[i]!.text = on ? (drafts.value[i]!.text ?? '') : undefined
  await nextTick()
  root.value?.querySelector<HTMLElement>(on ? '.pane.active textarea' : '.pane.active .pick')?.focus()
}
function send() {
  if (live.value && result.value.complete)
    emit('send', result.value.answers)
}

// Sent or answered: each header with its answer; 「터미널에서 답했어요」 when the terminal's pick is unknown
const summary = computed(() => props.questions.map((q, i) => ({
  header: q.header || `질문 ${i + 1}`,
  answer: props.texts[i] ?? (answerLabel(q.options.map(toChoice), props.picks[i] ?? []) || (props.state === 'terminal' ? '터미널에서 답했어요' : '')),
})))
const SUMMARY_HEAD: Partial<Record<QuestionState, string>> = { terminal: '터미널에서 모두 답했어요', done: '앱에서 모두 답했어요' }
</script>

<template>
  <QuestionCard
    v-if="questions.length === 1" :question="questions[0]!" :state="state" :picks="picks[0]" :answer-text="texts[0]"
    :inert="inert" :answered-at="answeredAt" :until="until" :now="now" :failure="failure" :retry="retry"
    @send="emit('send', { [questions[0]!.question]: $event })" @retry="emit('retry')"
  />
  <div v-else-if="state === 'terminal' || state === 'done' || state === 'sending'" ref="summaryEl" class="stepper summary" :class="state" tabindex="-1">
    <div v-if="state === 'sending'" class="summary-head">
      <span class="spin" aria-hidden="true" />답 {{ questions.length }}개 보내는 중
    </div>
    <!-- Answered: no head line; the answers' color says by whom (fg: this app, muted: the terminal) -->
    <span v-else class="sr-only">{{ SUMMARY_HEAD[state] }}<template v-if="state === 'done' && answeredAt"> · {{ clock(answeredAt) }}</template></span>
    <dl>
      <template v-for="(row, i) in summary" :key="i">
        <dt>{{ row.header }}</dt>
        <dd>{{ row.answer }}</dd>
      </template>
    </dl>
  </div>
  <div v-else ref="root" class="pages" :class="{ live }" role="group" :aria-label="`질문 ${questions.length}개`" tabindex="-1">
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
          <!-- Options and the typed answer share one cell too, so 「직접 답하기」 keeps the height -->
          <div v-if="live" class="answer-cell">
            <div
              class="picks" :class="{ away: drafts[i]?.text != null }" :inert="drafts[i]?.text != null || undefined"
              :role="p.question.multiSelect ? 'group' : 'radiogroup'" :aria-label="`${p.question.header || `질문 ${i + 1}`} 선택지`"
            >
              <button
                v-for="(o, j) in p.options" :key="j" class="pick" :class="{ on: drafts[i]?.text == null && drafts[i]?.picks.includes(j) }"
                type="button" :role="p.question.multiSelect ? 'checkbox' : 'radio'"
                :aria-checked="drafts[i]?.text == null && !!drafts[i]?.picks.includes(j)" @click="pick(i, j)"
              >
                <span class="number" :class="{ multi: p.question.multiSelect }" aria-hidden="true">
                  <ChatIcon v-if="drafts[i]?.text == null && drafts[i]?.picks.includes(j)" name="check" /><template v-else>{{ j + 1 }}</template>
                </span>
                <span>
                  <span class="label">{{ o.label }}</span><span v-if="o.recommended" class="rec">추천</span>
                  <span v-if="o.description" class="description">{{ o.description }}</span>
                </span>
              </button>
            </div>
            <textarea
              v-if="drafts[i]" v-model="drafts[i].text" class="typed" :class="{ away: drafts[i].text == null }"
              :inert="drafts[i].text == null || undefined" rows="3" :maxlength="ANSWER_MAX"
              :aria-label="`${p.question.header || `질문 ${i + 1}`} 직접 답하기`" placeholder="답을 적어 주세요"
            />
          </div>
          <ul v-else class="options" :aria-label="`${p.question.header || `질문 ${i + 1}`} 선택지, 읽기 전용`">
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
      <!-- The foot keeps its place on every page; the send button shows on the last -->
      <div v-if="live" class="q-foot">
        <button class="direct-reply" type="button" @click="typeAnswer(nav.step, drafts[nav.step]?.text == null)">
          {{ drafts[nav.step]?.text == null ? '직접 답하기' : '선택지로 돌아가기' }}
        </button>
        <button
          class="primary" :class="{ away: nav.next }" type="button" :disabled="!result.complete"
          :inert="!!nav.next || undefined" :aria-hidden="!!nav.next || undefined" @click="send"
        >
          {{ questions.length }}개 답 보내기
        </button>
      </div>
      <div v-if="live && state === 'fail'" class="q-state strong">
        <ChatIcon name="alert" />{{ FAILURE_NOTE[failure] }}<template v-if="retry">
          · <button class="link" type="button" @click="emit('retry')">
            다시 보내기
          </button>
        </template>
      </div>
      <div v-else-if="!live && state === 'fail'" class="q-state strong">
        <ChatIcon name="alert" />{{ FAILURE_NOTE[failure] }}
      </div>
      <div v-if="countdown" class="q-state hold" role="timer">
        {{ countdown }}
      </div>
      <span class="sr-only" role="status" aria-live="polite">{{ nav.step + 1 }}번째 질문 · {{ current.header || '세션에서 물었어요' }}</span>
      <div class="indicator">
        <button
          class="arrow" type="button" :disabled="!nav.previous"
          :aria-label="nav.previous ? `앞 질문 보기 · ${nav.previous.label}` : '앞 질문 없음'"
          @click="nav.previous && go(nav.previous.step, $event)"
        >
          <ChatIcon name="previous" />
        </button>
        <button
          v-for="(q, i) in questions" :key="i" class="dot" :class="{ current: i === nav.step, answered: live && result.answered[i] }" type="button"
          :aria-label="live && result.answered[i] ? `${stepName(i, q)} · 답함` : stepName(i, q)" :aria-current="i === nav.step ? 'step' : undefined" @click="go(i, $event)"
        >
          <span />
        </button>
        <button
          class="arrow" type="button" :disabled="!nav.next"
          :aria-label="nav.next ? `다음 질문 보기 · ${nav.next.label}` : '다음 질문 없음'"
          @click="nav.next && go(nav.next.step, $event)"
        >
          <ChatIcon name="next" />
        </button>
      </div>
    </div>
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

/* The current question fills the card, with the indicator at its foot */
.page {
  position: relative;
  min-width: 0;
  padding: 14px;
  border-radius: 16px;
  background: var(--bg);
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
.options .number,
.pick .number {
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* At the card's foot: ‹, a dot per question (the current one a longer --fg pill), › */
.indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin: 12px 0 -6px;
}
.arrow,
.dot {
  display: grid;
  place-items: center;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--muted);
}
.arrow {
  width: 28px;
}
.arrow:hover:not(:disabled) {
  color: var(--fg);
}
.arrow:disabled {
  opacity: 0.35;
}
.arrow .chat-icon {
  width: 16px;
  height: 16px;
}
.dot {
  width: 18px;
}
.dot span {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  transition: width 0.15s;
}
.dot:hover span {
  background: var(--muted);
}
.dot.current {
  width: 26px;
}
.dot.current span {
  width: 16px;
  background: var(--fg);
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

/* Held: the options turn into buttons, like the single card's rows */
.answer-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 14px;
}
.picks,
.answer-cell .typed {
  grid-area: 1 / 1;
  min-width: 0;
}
.picks {
  display: grid;
  gap: 6px;
  align-content: start;
}
.away {
  visibility: hidden;
}
.pick {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  text-align: left;
}
.pick:hover:not(:disabled) {
  background: var(--surface);
  border-color: var(--fg);
  color: var(--fg);
}
.pick .label {
  color: var(--fg);
}
.pick .number.multi {
  border-radius: 4px;
}
.pick.on {
  border-color: var(--fg);
}
.pick.on .number {
  border-color: var(--fg);
  background: var(--fg);
  color: var(--surface);
}
.pick .number .chat-icon {
  width: 11px;
  height: 11px;
  stroke-width: 3;
}
.answer-cell .typed {
  align-self: start;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  line-height: 1.6;
  resize: none;
  box-shadow: inset 0 0 0 1px var(--fg);
}
.answer-cell .typed::placeholder {
  color: var(--muted);
}
.q-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}
.direct-reply {
  min-height: 36px;
  padding: 0;
  font-size: 10px;
  color: var(--muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.direct-reply:hover:not(:disabled) {
  background: none;
  color: var(--fg);
}
.primary {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 12px;
  font-weight: 600;
}
.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  color: var(--on-accent);
}
.q-state {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}
.q-state.strong {
  color: var(--fg);
}
.q-state.hold {
  font-size: 10px;
}
.q-state .chat-icon,
.summary-head .chat-icon {
  width: 13px;
  height: 13px;
}
.link {
  min-height: auto;
  padding: 0;
  font-size: inherit;
  color: var(--fg);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.link:hover:not(:disabled) {
  background: none;
}
/* An answered question's dot fills, so the set shows what is left */
.dot.answered span {
  background: var(--muted);
}
.dot.answered.current span {
  background: var(--fg);
}
/* Answered in this app: the answers keep fg; the terminal's stay muted */
.summary.done dd {
  color: var(--fg);
}
.spin {
  width: 11px;
  height: 11px;
  flex: none;
  border: 1.5px solid var(--border);
  border-top-color: var(--fg);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 767px) {
  .stepper {
    padding: 14px;
  }
  .direct-reply {
    min-height: 44px;
    font-size: 11px;
  }
  .answer-cell .typed {
    font-size: 16px;
  }
}
@media (max-width: 767px), (pointer: coarse) {
  .direct-reply,
  .primary,
  .link {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
