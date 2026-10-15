// Service worker for the installed app: keeps the app shell so it opens without the server.
// The build (web/vite.config.ts) fills in BUILD and the SHELL list and emits it as /sw.js; a new build
// is a new file, so the browser installs it, and the old cache goes on activate.
// Stream data never goes through a cache here: /api, /ws and /img are left to the browser.

const BUILD = '__BUILD__'
const SHELL = ['__SHELL__']
const CACHE = `gollabara-${BUILD}`
// An unreachable tailnet host hangs instead of refusing; fall back to the cached shell after this
const NAVIGATION_TIMEOUT_MS = 3000

addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => globalThis.skipWaiting()))
})

addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('gollabara-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => globalThis.clients.claim()))
})

addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== location.origin)
    return
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws' || url.pathname.startsWith('/img/'))
    return

  // Pages: the network first, so a new build shows on the next open; the cached shell when it fails
  if (request.mode === 'navigate') {
    event.respondWith(withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS)
      .catch(() => caches.match('/').then(hit => hit ?? Response.error())))
    return
  }

  // Hashed build files never change: the cache first, filled as the app loads them (fonts, gallery chunks)
  event.respondWith(caches.match(request).then(hit => hit ?? fetch(request).then((response) => {
    // The server answers unknown paths with index.html; never keep that under an asset's name
    if (response.ok && url.pathname.startsWith('/assets/') && !response.headers.get('content-type')?.includes('text/html')) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)))
    }
    return response
  })))
})

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}
