<script setup lang="ts">
import type { Session, StreamMessage, Triage, TriageEngine } from '../../../src/shared/types'
import { computed, ref } from 'vue'
import ArtifactThumbs from '../components/chat/ArtifactThumbs.vue'
import { toFeed, toTimeline } from '../components/chat/chat'
import DateLabel from '../components/chat/DateLabel.vue'
import HiddenRow from '../components/chat/HiddenRow.vue'
import QuestionCard from '../components/chat/QuestionCard.vue'
import RecapLine from '../components/chat/RecapLine.vue'
import SessionMessage from '../components/chat/SessionMessage.vue'
import SessionStarts from '../components/chat/SessionStarts.vue'
import SystemLine from '../components/chat/SystemLine.vue'
import { toTriageMap, triageView } from '../triage'

// Gallery only: a chat feed run through the same rules as ChatPanel (triageView, toTimeline,
// toFeed), so cases show what the app draws for a given stream and set of verdicts
const props = withDefaults(defineProps<{
  messages: StreamMessage[]
  sessions?: Session[]
  triage?: Triage[]
  engine?: TriageEngine
  /** Lines already on screen before the verdicts came, for late hides */
  seen?: string[]
  /** Hidden rows open from the start, by row key */
  open?: string[]
}>(), { engine: 'claude' })

const view = computed(() => triageView(props.messages, {
  engine: props.engine,
  triage: toTriageMap(props.triage ?? []),
  now: Date.now(),
  seen: new Set(props.seen ?? []),
}))
const viewOf = computed(() => new Map(view.value.items.map(i => [i.message.id, i])))
const feed = computed(() => toFeed(
  toTimeline(view.value.items.map(i => i.message), props.sessions),
  (m) => {
    const v = viewOf.value.get(m.id)
    return v?.folded ? v.parts.flatMap(p => p.type === 'hidden' ? p.lines : []) : null
  },
))
const openRows = ref(new Set(props.open ?? []))
function toggle(key: string, open: boolean) {
  const next = new Set(openRows.value)
  if (open)
    next.add(key)
  else
    next.delete(key)
  openRows.value = next
}
const thumbs = (m: StreamMessage) => (m.images ?? []).map((img, i) => ({ key: `${m.id}-${i}`, ...img }))
</script>

<template>
  <template v-for="item in feed" :key="item.key">
    <DateLabel v-if="item.type === 'date'" :label="item.label" />
    <SystemLine v-else-if="item.type === 'system'" :icon="item.icon" :text="item.text" />
    <SessionStarts v-else-if="item.type === 'starts'" :rows="item.rows" :lead="item.lead" />
    <HiddenRow
      v-else-if="item.type === 'hidden'" :lines="item.lines"
      :model-value="openRows.has(item.key)" @update:model-value="toggle(item.key, $event)"
    />
    <SessionMessage v-else-if="item.type === 'message'" :name="item.message.sessionName" :at="item.message.at">
      <template v-for="part in viewOf.get(item.message.id)?.parts" :key="part.type === 'line' ? part.line.index : part.key">
        <RecapLine v-if="part.type === 'line'" :text="part.line.text" :tone="part.line.tone" :filled="part.line.filled" :weak="part.line.weak" />
        <HiddenRow v-else inset :lines="part.lines" :model-value="openRows.has(part.key)" @update:model-value="toggle(part.key, $event)" />
      </template>
      <ArtifactThumbs v-if="item.message.images?.length" :thumbs="thumbs(item.message)" :tool-name="item.message.toolName" />
      <QuestionCard v-for="(q, qi) in item.message.questions" :key="qi" :question="q" inert />
    </SessionMessage>
  </template>
</template>
