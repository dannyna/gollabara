<script setup lang="ts">
// One labelled state inside a *.gallery.vue file
defineProps<{ title: string }>()
</script>

<template>
  <section class="case">
    <h2 class="mono">
      {{ title }}
    </h2>
    <slot />
  </section>
</template>

<style scoped>
.case {
  padding: 16px 0 24px;
  border-bottom: 1px dashed var(--border);
}
h2 {
  padding: 0 18px 10px;
  color: var(--muted);
  font-weight: 400;
}
</style>
