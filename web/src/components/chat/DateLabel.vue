<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="date-label">
    {{ label }}
  </div>
</template>

<style scoped>
.date-label {
  display: flex;
  justify-content: center;
  margin: 3px 0 21px;
  color: var(--muted);
  font-size: 10px;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .date-label {
    margin-bottom: 12px;
  }
}
@media (max-width: 767px) {
  .date-label {
    margin: 2px 0 17px;
    font-size: 9px;
  }
}
</style>
