<script setup lang="ts">
// Under an empty area's title: the harnesses the server heard from, then the next step (#75).
// Outdated is said in words and an icon, never a state colour (the State Color Rule).
import type { Guide, GuidePlace } from '../../firstrun'
import { computed } from 'vue'
import { seenLabel, stepCopy } from '../../firstrun'
import BannerIcon from '../banner/BannerIcon.vue'
import CopyCommand from './CopyCommand.vue'

const props = defineProps<{
  guide: Guide
  /** In the chat, the list shows only where the stream is hidden (≤767px), so it is never drawn twice */
  place: GuidePlace
  /** Only the harnesses: the first-run page lays out its own steps */
  listOnly?: boolean
  /** Gallery: a fixed "now" for the seen times */
  now?: number
}>()
const copy = computed(() => stepCopy(props.guide.step, props.place))
</script>

<template>
  <div class="harness-guide" :class="[place, { 'list-only': listOnly }]">
    <ul class="harnesses" aria-label="연결된 하네스">
      <li v-for="h in guide.harnesses" :key="h.harness">
        <BannerIcon :name="h.outdated ? 'alert' : 'check'" />
        <span class="name">{{ h.label }}</span>
        <span class="state">{{ h.outdated ? '플러그인이 오래됐어요' : '연결됨' }}</span>
        <span class="mono at">
          <template v-if="h.outdated">{{ h.version ?? '버전 없음' }} · </template>{{ seenLabel(h.seenAt, now) }}
        </span>
      </li>
      <li v-if="!guide.harnesses.length" class="none">
        <BannerIcon name="plug" />
        <span class="state">아직 연결된 하네스가 없어요</span>
      </li>
    </ul>
    <div v-if="!listOnly" class="next">
      <p class="next-title">
        {{ copy.title }}
      </p>
      <p v-if="copy.description" class="next-desc">
        {{ copy.description }}
      </p>
      <CopyCommand v-if="copy.command" :command="copy.command" />
    </div>
  </div>
</template>

<style scoped>
.harness-guide {
  width: min(360px, 100%);
  margin-top: 18px;
  text-align: left;
}
.harnesses {
  margin: 0;
  padding: 0 12px;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.harnesses li {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--muted);
}
.harnesses li + li {
  border-top: 1px solid var(--border);
}
.harnesses .banner-icon {
  color: var(--fg);
}
.none .banner-icon {
  color: var(--muted);
}
.name {
  color: var(--fg);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.state {
  min-width: 0;
}
.at {
  margin-left: auto;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.next {
  margin-top: 16px;
}
.next-title {
  color: var(--fg);
  font-size: 13px;
  font-weight: 600;
}
.next-desc {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--muted);
}
.list-only {
  width: 100%;
  margin-top: 12px;
}
@media (min-width: 768px) {
  .chat .harnesses {
    display: none;
  }
  .chat .next {
    margin-top: 0;
  }
}
</style>
