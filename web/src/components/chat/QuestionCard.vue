<script setup lang="ts">
import type { Question } from '../../../../src/shared/types'
import type { AnswerFailure } from '../../answers'
import { computed, nextTick, ref, watch } from 'vue'
import { ANSWER_MAX } from '../../../../src/shared/answer'
import { FAILURE_NOTE, holdNote, rawAnswer } from '../../answers'
import { clock } from '../../artifacts'
import { answerLabel, choiceLayout, toChoice } from './chat'
import ChatIcon from './ChatIcon.vue'

// The session's own AskUserQuestion, word for word. The only surface inside a
// session message. It answers only while the session's hook holds the question
// (answers.ts decides); otherwise it is drawn inert. The card sends nothing
// itself: it emits the answer and its parent posts it.
export type QuestionState = 'open' | 'typed' | 'sending' | 'done' | 'terminal' | 'fail' | 'offline'

const props = withDefaults(defineProps<{
  question: Question
  state?: QuestionState
  /** Picked option indexes */
  picks?: number[]
  /** 「1 / 3」 when the session asked several questions */
  count?: string
  /** The direct reply's text in the typed state */
  typed?: string
  /** A free-text answer (no label), shown instead of the picks once sent or answered */
  answerText?: string
  answeredAt?: number
  /** Not answerable now: every control is drawn but disabled */
  inert?: boolean
  /** While held: when the hold ends, and the clock the countdown reads */
  until?: number
  now?: number
  /** In the fail state: why it failed, and whether 「다시 보내기」 can go */
  failure?: AnswerFailure
  retry?: boolean
}>(), { state: 'open', picks: () => [], failure: 'network' })

const emit = defineEmits<{
  /** The answer as Claude Code expects it: a raw label, labels joined with ", ", or typed text */
  send: [answer: string]
  /** 「다시 보내기」: the same answer again */
  retry: []
}>()

const options = computed(() => props.question.options.map(toChoice))
const layout = computed(() => choiceLayout(options.value))
const multi = computed(() => !!props.question.multiSelect)
// 「직접 답하기」 opens the typed state inside the card
const typing = ref(props.state === 'typed')
const view = computed<QuestionState>(() => props.state === 'open' && typing.value ? 'typed' : props.state)
const closed = computed(() => ['sending', 'done', 'terminal'].includes(view.value))
const locked = computed(() => closed.value || view.value === 'offline' || (view.value === 'fail' && !props.retry) || props.inert)

const chosen = ref<number[]>([...props.picks])
// By value: the parent hands a new array on every countdown tick, which must not drop the picks
watch(() => props.picks.join(), () => chosen.value = [...props.picks])
const text = ref(props.typed ?? '')
watch(() => props.typed, t => text.value = t ?? '')
const field = ref<HTMLTextAreaElement>()
const root = ref<HTMLElement>()
// Sending disables or replaces the control that sent (a pick, 「보내기」, 「다시 보내기」), which would drop
// focus to the page: the card takes it instead, if it was inside the card
watch(locked, async (on, before) => {
  if (!on || before || !root.value?.contains(document.activeElement))
    return
  await nextTick()
  const active = document.activeElement as HTMLButtonElement | null
  if (!root.value?.contains(active) || active?.disabled)
    root.value?.focus({ preventScroll: true })
}, { flush: 'pre' })
// A hold that runs out mid-answer leaves the read-only card, not a disabled draft
watch(() => props.inert, (inert) => {
  if (inert && props.state === 'open') {
    typing.value = false
    chosen.value = [...props.picks]
  }
})

function toggle(i: number) {
  if (locked.value)
    return
  if (multi.value) {
    chosen.value = chosen.value.includes(i) ? chosen.value.filter(x => x !== i) : [...chosen.value, i]
    return
  }
  chosen.value = [i]
  // A single choice is the answer: it goes at once
  emit('send', rawAnswer(props.question, [i]))
}
function sendPicks() {
  if (!locked.value && chosen.value.length)
    emit('send', rawAnswer(props.question, chosen.value))
}
function sendText() {
  if (!props.inert && text.value.trim())
    emit('send', text.value.trim())
}
async function openTyped() {
  if (props.inert)
    return
  typing.value = true
  await nextTick()
  field.value?.focus()
}
const picked = computed(() => props.answerText ?? answerLabel(options.value, chosen.value))
const countdown = computed(() => props.until != null && props.now != null && !props.inert ? holdNote(props.until, props.now) : undefined)
</script>

<template>
  <div ref="root" class="question" :class="{ closed, offline: view === 'offline', inert }" tabindex="-1">
    <div class="eyebrow">
      <ChatIcon name="question" /><b>{{ question.header || '세션에서 물었어요' }}</b>
      <template v-if="multi">
        · 여러 개 고르기
      </template>
      <span v-if="count" class="count">{{ count }}</span>
    </div>
    <p>{{ question.question }}</p>

    <template v-if="view === 'typed'">
      <textarea
        ref="field" v-model="text" class="typed" rows="2" :maxlength="ANSWER_MAX"
        :disabled="inert" aria-label="직접 답하기" placeholder="답을 적어 주세요"
      />
      <div class="q-foot">
        <button class="direct-reply" type="button" :disabled="inert" @click="typing = false">
          선택지로 돌아가기
        </button>
        <button class="primary" type="button" :disabled="inert || !text.trim()" @click="sendText">
          보내기
        </button>
      </div>
    </template>
    <div v-else-if="layout === 'short'" class="choices" :role="multi ? 'group' : 'radiogroup'">
      <button
        v-for="(o, i) in options" :key="i" class="choice" :class="{ chosen: chosen.includes(i) }" type="button"
        :role="multi ? 'checkbox' : 'radio'" :aria-checked="chosen.includes(i)" :disabled="locked" @click="toggle(i)"
      >
        {{ o.label }}<span v-if="o.recommended" class="rec">추천</span>
      </button>
    </div>
    <div v-else class="opt-list" :role="multi ? 'group' : 'radiogroup'">
      <button
        v-for="(o, i) in options" :key="i" class="opt" :class="{ multi, on: chosen.includes(i) }" type="button"
        :role="multi ? 'checkbox' : 'radio'" :aria-checked="chosen.includes(i)" :disabled="locked" @click="toggle(i)"
      >
        <span class="mark"><ChatIcon v-if="chosen.includes(i)" name="check" /></span>
        <span>
          <span class="t">{{ o.label }}<span v-if="o.recommended" class="rec">추천</span></span>
          <span v-if="o.description" class="d">{{ o.description }}</span>
        </span>
      </button>
    </div>

    <template v-if="view === 'open' || view === 'fail'">
      <template v-if="view === 'fail'">
        <div class="q-state strong">
          <ChatIcon name="alert" />{{ FAILURE_NOTE[failure] }}<template v-if="retry">
            · <button class="link" type="button" :disabled="inert" @click="emit('retry')">
              다시 보내기
            </button>
          </template>
        </div>
        <div v-if="failure !== 'closed'" class="q-state">
          터미널에서 바로 답해도 돼요
        </div>
      </template>
      <div v-else-if="multi" class="q-foot">
        <button class="direct-reply" type="button" :disabled="inert" @click="openTyped">
          직접 답하기
        </button>
        <button class="primary" type="button" :disabled="inert || !chosen.length" @click="sendPicks">
          {{ chosen.length ? `${chosen.length}개 골라 보내기` : '골라 주세요' }}
        </button>
      </div>
      <button v-else class="direct-reply" type="button" :disabled="inert" @click="openTyped">
        직접 답하기
      </button>
    </template>
    <div v-else-if="view === 'sending'" class="q-state">
      <span class="spin" aria-hidden="true" />{{ picked }}로 답하는 중
    </div>
    <div v-else-if="view === 'done'" class="q-state strong">
      <ChatIcon name="check" />{{ picked }}로 답했어요<template v-if="answeredAt">
        · <time>{{ clock(answeredAt) }}</time>
      </template>
    </div>
    <div v-else-if="view === 'terminal'" class="q-state strong">
      <ChatIcon name="term" />{{ picked ? `터미널에서 ${picked}로 먼저 답했어요` : '터미널에서 먼저 답했어요' }}
    </div>
    <!-- Only a question still held can be answered after reconnecting -->
    <div v-else-if="view === 'offline' && !inert" class="q-state">
      <ChatIcon name="plug" />다시 연결되면 답할 수 있어요
    </div>
    <div v-if="countdown && (view === 'open' || view === 'typed' || view === 'fail')" class="q-state hold" role="timer">
      {{ countdown }}
    </div>
  </div>
</template>

<style scoped>
.question {
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
}
.eyebrow .chat-icon {
  width: 13px;
  height: 13px;
}
.eyebrow b {
  color: var(--fg);
  font-weight: 600;
}
.eyebrow .count {
  margin-left: auto;
  font-family: var(--mono);
}
.question p {
  font-size: 12px;
  line-height: 1.7;
}

/* Short labels side by side */
.choices {
  display: flex;
  gap: 6px;
  margin-top: 11px;
}
.choice {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  font: 500 12px var(--mono);
}
.choice:hover:not(:disabled) {
  background: var(--surface);
  color: var(--fg);
  border-color: var(--fg);
}
.choice .rec {
  margin-left: 5px;
  font: 9px var(--body);
  color: var(--muted);
}
.choice.chosen,
.choice.chosen:hover {
  border-color: var(--fg);
  background: var(--fg);
  color: var(--surface);
}
.choice.chosen .rec {
  color: inherit;
}

/* One row per option: label + description */
.opt-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}
.opt {
  width: 100%;
  min-height: 52px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  text-align: left;
}
.opt:hover:not(:disabled) {
  background: var(--surface);
  border-color: var(--fg);
  color: var(--fg);
}
.opt:disabled {
  opacity: 1;
}
.mark {
  width: 16px;
  height: 16px;
  flex: none;
  display: grid;
  place-items: center;
  margin-top: 2px;
  border: 1.5px solid var(--muted);
  border-radius: 50%;
}
.opt.multi .mark {
  border-radius: 4px;
}
.opt.on {
  border-color: var(--fg);
}
.opt.on .mark {
  border-color: var(--fg);
  background: var(--fg);
  color: var(--surface);
}
.mark .chat-icon {
  width: 11px;
  height: 11px;
  stroke-width: 3;
}
.t {
  display: block;
  font-size: 12px;
  font-weight: 500;
}
.t .rec {
  margin-left: 6px;
  font: 400 10px var(--body);
  color: var(--muted);
}
.d {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}

/* Closed: only the pick keeps fg */
.closed .opt:not(.on),
.closed .choice:not(.chosen),
.offline .opt {
  color: var(--muted);
}
.closed .opt:not(.on) .mark,
.offline .opt .mark {
  border-color: var(--border);
}
/* Drawn but not answerable yet: options keep full contrast so the question stays readable */
.inert .choice:disabled {
  opacity: 1;
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
.q-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
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
.typed {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  box-shadow: inset 0 0 0 1px var(--fg);
}
.typed::placeholder {
  color: var(--muted);
}
.q-state {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}
.q-state.strong {
  color: var(--fg);
}
/* The countdown sits under the actions, a step quieter; role=timer keeps it from being announced each second */
.q-state.hold {
  font-size: 10px;
}
.q-state .chat-icon {
  width: 13px;
  height: 13px;
}
.q-state time {
  font-size: inherit;
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
  .question {
    padding: 14px;
  }
  .choice {
    min-height: 46px;
  }
  .direct-reply {
    min-height: 44px;
    font-size: 11px;
  }
  /* 16px keeps iOS from zooming into the field */
  .typed {
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
