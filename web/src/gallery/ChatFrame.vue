<script setup lang="ts">
// A 440px chat surface for gallery cases, like the frames in the OD session-chat guide
defineProps<{ note?: string }>()
</script>

<template>
  <div class="chat-frame">
    <div v-if="$slots.default" class="chat-feed">
      <slot />
    </div>
    <slot name="footer" />
  </div>
  <p v-if="note" class="note">
    {{ note }}
  </p>
</template>

<style scoped>
.chat-frame {
  width: min(440px, calc(100% - 36px));
  margin: 0 18px;
  overflow: hidden;
  border-radius: 24px;
  background: var(--surface);
}
.chat-feed {
  padding: 22px 22px 6px;
}
.chat-feed > :deep(:last-child) {
  margin-bottom: 14px;
}
.note {
  max-width: 440px;
  margin: 12px 18px 0;
  font-size: 12px;
  line-height: 1.75;
  color: var(--muted);
}
</style>
