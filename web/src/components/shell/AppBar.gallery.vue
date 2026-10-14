<script setup lang="ts">
import GalleryCase from '../../gallery/GalleryCase.vue'
import AppBar from './AppBar.vue'
</script>

<template>
  <GalleryCase title="default · 전체 세션">
    <AppBar />
  </GalleryCase>
  <GalleryCase title="selected session · long name ellipsis">
    <AppBar scope-label="checkout-redesign-experiment · feat/payment-sheet-variants" />
  </GalleryCase>
  <GalleryCase title="session menu open">
    <AppBar scope-label="piuda · desktop-shell" sessions-open />
  </GalleryCase>
  <GalleryCase title="disconnected · 다시 연결 중">
    <AppBar offline />
  </GalleryCase>
  <GalleryCase title="reconnected · 다시 연결됐어요 (3 s)">
    <AppBar connection="restored" />
  </GalleryCase>
  <GalleryCase title="first connection · session button hidden">
    <AppBar :show-session-button="false" />
  </GalleryCase>
</template>
