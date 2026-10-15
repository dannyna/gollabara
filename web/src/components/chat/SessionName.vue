<script setup lang="ts">
import { computed } from 'vue'
import { splitSessionName } from '../../artifacts'

// `<dir> · <branch>` on one line. The dir is never cut; only a long branch ends in 「…」,
// and the full name is in the tooltip.
const props = defineProps<{ name: string }>()
const parts = computed(() => splitSessionName(props.name))
</script>

<template>
  <span class="session-name" :title="name"><span class="dir">{{ parts.session }}</span><span v-if="parts.branch" class="branch">&nbsp;· {{ parts.branch }}</span></span>
</template>

<style scoped>
.session-name {
  display: flex;
  min-width: 0;
  white-space: nowrap;
}
.dir {
  flex: none;
}
.branch {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--muted);
  font-weight: 400;
}
</style>
