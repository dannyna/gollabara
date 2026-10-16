<script setup lang="ts">
import { clock } from '../../artifacts'
import ChatIcon from './ChatIcon.vue'

// A message the reader sent, with its delivery state. The state comes from props: the
// app feeds it from the feedback records the server streams.
/** `queued`: handed off, not yet confirmed (보내는 중) */
export type DeliveryState = 'queued' | 'delivered' | 'failed' | 'none'

withDefaults(defineProps<{
  /** Receiving session */
  target: string
  /** Parent path before the target when another session has the same dir (names.ts) */
  targetHint?: string
  text: string
  /** Quoted artifact (thumbnail + label) or session message (first line) */
  quote?: { text: string, image?: string }
  /** `delivered` belongs on the latest bubble only; older ones pass `none` */
  state?: DeliveryState
  /** Delivery time, shown with `delivered` */
  at?: number
  /** How the session picked it up, as a tooltip on the delivered line */
  via?: string
  /** Replaces 「전달하지 못했어요」 when the cause is known */
  reason?: string
}>(), { state: 'delivered' })
defineEmits<{ retry: [] }>()
</script>

<template>
  <article class="mine">
    <div class="target">
      → {{ targetHint }}{{ target }}
    </div>
    <div class="my-bubble">
      <div v-if="quote" class="quote">
        <img v-if="quote.image" :src="quote.image" alt=""><span>↪ {{ quote.text }}</span>
      </div>
      {{ text }}
    </div>
    <div v-if="state === 'queued'" class="delivery">
      <span class="spin" aria-hidden="true" />보내는 중
    </div>
    <div v-else-if="state === 'delivered'" class="delivery" :title="via">
      <ChatIcon name="check" />전달됨<template v-if="at">
        · <time>{{ clock(at) }}</time>
      </template>
    </div>
    <div v-else-if="state === 'failed'" class="delivery fail">
      <ChatIcon name="alert" />{{ reason ?? '전달하지 못했어요' }} · <button class="link" type="button" @click="$emit('retry')">
        다시 보내기
      </button>
    </div>
  </article>
</template>

<style scoped>
.mine {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: -4px 0 20px;
}
.target {
  margin-bottom: 4px;
  color: var(--muted);
  font: 500 10px var(--mono);
}
.my-bubble {
  max-width: 92%;
  padding: 9px 13px;
  border-radius: 15px 15px 4px 15px;
  background: var(--bg);
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.quote {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  font-size: 10px;
  color: var(--muted);
}
.quote img {
  width: 18px;
  height: 28px;
  object-fit: cover;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.delivery {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  font-size: 9px;
  color: var(--muted);
}
.delivery.fail {
  color: var(--fg);
}
.delivery .chat-icon {
  width: 13px;
  height: 13px;
}
.delivery time {
  font-size: inherit;
}
.link {
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
@media (min-width: 768px) and (max-width: 1023px) {
  .mine {
    margin-left: auto;
    max-width: 85%;
  }
}
@media (max-width: 767px) {
  .my-bubble {
    max-width: 94%;
  }
}
@media (max-width: 767px), (pointer: coarse) {
  .link {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
