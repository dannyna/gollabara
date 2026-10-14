<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import AppBar from './AppBar.vue'
import EmptyState from './EmptyState.vue'
</script>

<template>
  <GalleryCase title="server running · step 1 done">
    <div class="app">
      <AppBar :show-session-button="false" />
      <EmptyState connected />
    </div>
  </GalleryCase>
  <GalleryCase title="server not answering · step 1 current, the rest wait">
    <div class="app">
      <AppBar :show-session-button="false" />
      <EmptyState />
    </div>
  </GalleryCase>
</template>

<style scoped>
.app {
  height: 720px;
  display: flex;
  flex-direction: column;
  padding: 0 18px 18px;
}
@media (max-width: 767px) {
  .app {
    padding: 0;
  }
}
</style>
