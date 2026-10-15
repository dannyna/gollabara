<script setup lang="ts">
// The first-run page: nothing has arrived and no session is known yet (#75). The steps advance with
// what the server knows: whether it answers, which harnesses posted, and whether a hook is outdated.
import type { Guide } from '../../firstrun'
import { computed } from 'vue'
import { stepCopy } from '../../firstrun'
import CopyCommand from './CopyCommand.vue'
import HarnessGuide from './HarnessGuide.vue'

const props = defineProps<{
  connected?: boolean
  /** null until `GET /api/health` answered */
  guide?: Guide | null
  /** Gallery: a fixed "now" for the seen times */
  now?: number
}>()

// One install command sets up the server, its login service and every detected harness
const SETUP = stepCopy('setup', 'page')
const UPDATE = stepCopy('update', 'page')
const START = stepCopy('start', 'page')

const step = computed(() => props.guide?.step)
/** The first step not done yet; later ones wait in muted text */
const current = computed(() => !props.connected ? 1 : step.value === 'setup' || step.value === 'update' ? 2 : step.value ? 3 : 0)
</script>

<template>
  <section class="empty" aria-label="첫 연결 안내">
    <div class="inner">
      <svg class="symbol" viewBox="0 0 512 512" aria-hidden="true"><path d="M198 120h-78v272h78m116-272h78v272h-78" fill="none" stroke="currentColor" stroke-width="20" /><circle cx="256" cy="256" r="18" fill="currentColor" /></svg>
      <h1>세션에서 만든 산출물이<br>여기에 모입니다</h1>
      <p class="intro">
        켜 두고 구경하세요. 말을 걸고 싶을 때만 한마디.
      </p>
      <ol class="setup">
        <li :class="{ current: current === 1 }">
          <span class="step">1</span>
          <div class="content">
            <h3 v-if="connected">
              서버 실행 중 ✓
            </h3>
            <template v-else>
              <h3>서버를 켜 주세요</h3>
              <CopyCommand :command="SETUP.command!" />
              <p>서버를 로그인 서비스로 설치하고, 플러그인도 함께 연결해요. 켜지면 이 줄에 ✓가 붙어요.</p>
            </template>
          </div>
        </li>
        <li :class="{ current: current === 2, todo: current < 2 }">
          <span class="step">2</span>
          <div class="content">
            <h3>{{ guide?.harnesses.length && step !== 'update' ? 'Claude Code나 Codex 연결됨 ✓' : 'Claude Code나 Codex 연결' }}</h3>
            <p v-if="!connected">
              서버가 켜지면 이어서 할 수 있어요.
            </p>
            <template v-else-if="guide">
              <HarnessGuide v-if="guide.harnesses.length" :guide="guide" place="page" list-only :now="now" />
              <template v-if="step === 'setup'">
                <CopyCommand :command="SETUP.command!" />
                <p>{{ SETUP.description }}</p>
              </template>
              <template v-else-if="step === 'update'">
                <p>{{ UPDATE.title }}. {{ UPDATE.description }}</p>
                <CopyCommand :command="UPDATE.command!" />
              </template>
            </template>
          </div>
        </li>
        <li :class="{ current: current === 3, todo: current < 3 }">
          <span class="step">3</span>
          <div class="content">
            <h3>{{ START.title }}</h3>
            <p>{{ START.description }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.empty {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 38px 24px;
}
.inner {
  width: min(560px, 100%);
}
.symbol {
  display: block;
  width: 58px;
  height: 58px;
  margin-bottom: 25px;
  color: var(--muted);
}
h1 {
  font-size: 26px;
  line-height: 1.5;
  letter-spacing: -1px;
  text-wrap: balance;
}
.intro {
  margin-top: 10px;
  color: var(--muted);
  font-size: 13px;
}
.setup {
  margin: 32px 0 0;
  padding: 0;
  list-style: none;
}
.setup li {
  display: flex;
  gap: 16px;
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
}
.setup li:last-child {
  border: 0;
}
.step {
  width: 25px;
  height: 25px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  font: 12px var(--mono);
}
.current .step {
  background: var(--fg);
  color: var(--surface);
  border-color: var(--fg);
}
.todo .step,
.todo h3 {
  color: var(--muted);
}
.content {
  min-width: 0;
  flex: 1;
}
h3 {
  font-size: 13px;
}
.content p {
  margin-top: 5px;
  font-size: 11px;
  color: var(--muted);
}
.content .code-copy + p {
  margin-top: 8px;
}

@media (max-width: 767px) {
  .empty {
    align-items: flex-start;
    padding: 26px 22px;
  }
  .symbol {
    width: 43px;
    height: 43px;
    margin-bottom: 18px;
  }
  h1 {
    font-size: 23px;
  }
  .intro {
    font-size: 12px;
  }
  .setup {
    margin-top: 20px;
  }
  .setup li {
    padding: 16px 0;
  }
}
</style>
