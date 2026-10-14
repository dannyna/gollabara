import { createApp } from 'vue'
import App from './App.vue'
import { applyTheme, useTheme } from './theme'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/noto-sans-kr/400.css'
import '@fontsource/noto-sans-kr/500.css'
import '@fontsource/noto-sans-kr/600.css'
import '@fontsource/noto-sans-kr/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import './style.css'

// `/?gallery` opens the component gallery instead of the app. It is lazy-loaded
// and never opens the stream WebSocket.
if (new URLSearchParams(location.search).has('gallery')) {
  import('./gallery/GalleryApp.vue').then(m => createApp(m.default).mount('#app'))
}
else {
  applyTheme(useTheme().preference.value)
  createApp(App).mount('#app')
}
