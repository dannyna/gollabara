<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ connected?: boolean }>()

// Same command as README "Try it"; run from the repository folder
const INSTALL = 'claude plugin marketplace add ./ && claude plugin install gollabara@gollabara'

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(INSTALL)
    copied.value = true
    setTimeout(() => copied.value = false, 1500)
  }
  catch {}
}
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
        <li>
          <span class="step">1</span>
          <div class="content">
            <h3 v-if="connected">
              서버 실행 중 ✓
            </h3>
            <h3 v-else>
              서버를 기다리는 중
            </h3>
            <p v-if="!connected" class="mono">
              bun src/cli.ts serve
            </p>
          </div>
        </li>
        <li>
          <span class="step">2</span>
          <div class="content">
            <h3>Claude Code에 플러그인 설치</h3>
            <div class="code-copy">
              <code>{{ INSTALL }}</code>
              <button class="icon-button" type="button" :aria-label="copied ? '복사했어요' : '설치 명령 복사'" @click="copy">
                <svg v-if="copied" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></svg>
              </button>
            </div>
            <p>gollabara 저장소 폴더에서 실행하세요.</p>
          </div>
        </li>
        <li>
          <span class="step">3</span>
          <div class="content">
            <h3>폰에서도 구경하기</h3>
            <p>준비 중이에요. 폰 접속은 다음 단계에서 붙어요.</p>
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
.code-copy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 4px 5px 4px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.code-copy code {
  flex: 1;
  font: 11px var(--mono);
  overflow-wrap: anywhere;
  word-break: break-all;
}
.icon-button {
  width: 44px;
  height: 44px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
}
.icon-button svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
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
