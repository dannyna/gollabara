<script setup lang="ts">
import { computed } from 'vue'
import { splitSessionName } from '../../artifacts'

// `<dir> · <branch>` on one line. A long branch ends in 「…」 first; the dir is cut only when
// it alone is wider than the box (a narrow stream cell). The full name is in the tooltip.
// `hint` (names.ts) is a muted parent path before the dir, only when another session shares the name.
const props = defineProps<{ name: string, hint?: string }>()
const parts = computed(() => splitSessionName(props.name))
</script>

<template>
  <span class="session-name" :title="(hint ?? '') + name"><span v-if="hint" class="name-hint">{{ hint }}</span><span class="dir">{{ parts.session }}</span><span v-if="parts.branch" class="branch">&nbsp;· {{ parts.branch }}</span></span>
</template>

<style scoped>
.session-name {
  display: flex;
  min-width: 0;
  white-space: nowrap;
}
/* No shrink, so a dir that fits is never cut; the max-width only catches one that cannot */
.dir {
  flex: none;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The hint gives way after the branch: it is what tells the session apart */
.name-hint {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--muted);
  font-weight: 400;
}
.branch {
  flex-shrink: 1000;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--muted);
  font-weight: 400;
}
</style>
