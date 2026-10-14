<script setup lang="ts">
// App-bar status chip, right of the logo. It only speaks when the connection is not
// normal: never counts, never an always-on badge (DESIGN.md). Not a button: the stream
// retries on its own, so there is nothing for the user to do.
import type { ConnectionStatus } from './notices'
import BannerIcon from './BannerIcon.vue'

defineProps<{ status: ConnectionStatus }>()
</script>

<template>
  <!-- The only live region for the connection. The element stays mounted and only its
       text changes, so 「다시 연결됐어요」 is read once by the same region. -->
  <span class="connection-chip" role="status">
    <template v-if="status === 'offline'">다시 연결 중</template>
    <template v-else-if="status === 'restored'"><BannerIcon name="check" />다시 연결됐어요</template>
  </span>
</template>

<style scoped>
.connection-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
}
.connection-chip:empty {
  display: none;
}
.connection-chip .banner-icon {
  width: 12px;
  height: 12px;
}
</style>
