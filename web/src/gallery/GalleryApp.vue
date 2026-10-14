<script setup lang="ts">
// Component gallery at `/?gallery`. Every `web/src/components/**/*.gallery.vue` shows
// up here on its own; there is no registry to edit.
//
// Each preview runs in an iframe (`/?gallery=<id>&frame&theme=…`) so the frame width
// drives the real media queries and the theme stays local to the frame.

import type { Component } from 'vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'

const modules = import.meta.glob<{ default: Component }>('../components/**/*.gallery.vue')
// '../components/shell/AppBar.gallery.vue' -> 'shell/AppBar'
const entries = Object.keys(modules)
  .map(path => ({ id: path.slice('../components/'.length, -'.gallery.vue'.length), path }))
  .sort((a, b) => a.id.localeCompare(b.id))

const WIDTHS = {
  desktop: { label: '데스크톱', width: 1280, height: 800 },
  tablet: { label: '태블릿', width: 834, height: 1000 },
  mobile: { label: '모바일', width: 390, height: 844 },
} as const
type Width = keyof typeof WIDTHS
type Theme = 'dark' | 'light'

const params = new URLSearchParams(location.search)
const frame = params.has('frame')
const theme = ref<Theme>(params.get('theme') === 'light' ? 'light' : 'dark')
const width = ref<Width>((params.get('width') as Width) in WIDTHS ? params.get('width') as Width : 'desktop')
const current = ref(entries.find(e => e.id === params.get('gallery'))?.id ?? entries[0]?.id)

// Inside a frame the theme applies to the whole document; never persisted
document.documentElement.dataset.theme = frame ? theme.value : 'dark'

const preview = computed(() => {
  const entry = entries.find(e => e.id === current.value)
  return entry && defineAsyncComponent(modules[entry.path]!)
})
const frameSrc = computed(() => `/?gallery=${encodeURIComponent(current.value ?? '')}&frame&theme=${theme.value}`)

// Keep the choice in the URL so a reload or a shared link lands on the same view
watch([current, theme, width], () => {
  if (!frame)
    history.replaceState(null, '', `/?gallery=${encodeURIComponent(current.value ?? '')}&theme=${theme.value}&width=${width.value}`)
})
</script>

<template>
  <component :is="preview" v-if="frame && preview" />
  <div v-else class="gallery">
    <nav class="list" aria-label="컴포넌트">
      <p class="mono muted">
        gallery
      </p>
      <button
        v-for="e in entries" :key="e.id" type="button" class="entry"
        :aria-current="e.id === current" @click="current = e.id"
      >
        {{ e.id }}
      </button>
      <p v-if="!entries.length" class="muted">
        *.gallery.vue 파일이 없어요.
      </p>
    </nav>
    <div class="stage">
      <div class="tools">
        <div class="group" role="group" aria-label="테마">
          <button v-for="t in (['dark', 'light'] as const)" :key="t" type="button" :aria-pressed="theme === t" @click="theme = t">
            {{ t }}
          </button>
        </div>
        <div class="group" role="group" aria-label="너비">
          <button v-for="(w, key) in WIDTHS" :key="key" type="button" :aria-pressed="width === key" @click="width = key">
            {{ w.label }} <span class="mono">{{ w.width }}</span>
          </button>
        </div>
      </div>
      <div class="canvas">
        <iframe
          v-if="current" :key="frameSrc" :src="frameSrc" :title="current"
          :width="WIDTHS[width].width" :height="WIDTHS[width].height"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery {
  height: 100dvh;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 18px 12px;
  overflow: auto;
  background: var(--surface);
}
.list p {
  padding: 0 10px 10px;
}
.entry {
  min-height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  text-align: left;
  font: 12px var(--mono);
}
.entry[aria-current='true'] {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--muted);
}
.stage {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 18px;
}
.group {
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  background: var(--surface);
}
.group button {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 9px;
  font-size: 12px;
}
.group button[aria-pressed='true'] {
  background: var(--fg);
  color: var(--bg);
}
.canvas {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 18px 18px;
}
iframe {
  display: block;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
}
</style>
