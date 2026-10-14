// `golla serve` — receives artifacts, stores them, and streams them to every open view.

import type { IncomingEvent, ServerFrame } from '../shared/types'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dataDir, serverPort } from '../shared/config'
import { Store } from './store'

const WEB_DIST = resolve(import.meta.dir, '../../web/dist')
const TOPIC = 'stream'

export function startServer() {
  const store = new Store(dataDir())

  const server = Bun.serve({
    port: serverPort(),
    // Listen on all interfaces so devices on the same network or tailnet can open it too
    hostname: '0.0.0.0',
    async fetch(req, srv) {
      const url = new URL(req.url)

      if (url.pathname === '/ws') {
        return srv.upgrade(req) ? undefined : new Response('upgrade failed', { status: 400 })
      }

      if (url.pathname === '/api/events' && req.method === 'POST') {
        const event = await req.json() as IncomingEvent
        const { session, message, created } = store.ingest(event)
        srv.publish(TOPIC, JSON.stringify({ type: 'session', session } satisfies ServerFrame))
        if (message)
          srv.publish(TOPIC, JSON.stringify({ type: created ? 'message' : 'message-upsert', message } satisfies ServerFrame))
        return Response.json({ ok: true, id: message?.id ?? null })
      }

      if (url.pathname === '/api/messages')
        return Response.json(store.recent())

      if (url.pathname === '/api/sessions')
        return Response.json(store.sessions())

      if (url.pathname.startsWith('/img/')) {
        const file = Bun.file(join(store.imageDir, url.pathname.slice('/img/'.length).replace(/[^\w.]/g, '')))
        return (await file.exists())
          ? new Response(file, { headers: { 'cache-control': 'public, max-age=31536000, immutable' } })
          : new Response('not found', { status: 404 })
      }

      return serveWeb(url.pathname)
    },
    websocket: {
      open(ws) {
        ws.subscribe(TOPIC)
        ws.send(JSON.stringify({ type: 'hello', messages: store.recent(), sessions: store.sessions() } satisfies ServerFrame))
      },
      message() {},
    },
  })

  console.log(`gollabara is watching at http://localhost:${server.port}`)
  return server
}

function serveWeb(pathname: string): Response {
  if (!existsSync(WEB_DIST))
    return new Response('web/dist is missing. Use `bun run build:web` or `bun run dev:web`.', { status: 503 })
  const safe = pathname.replace(/\.{2,}/g, '')
  const file = Bun.file(join(WEB_DIST, safe === '/' ? 'index.html' : safe))
  return new Response(file.size > 0 ? file : Bun.file(join(WEB_DIST, 'index.html')))
}
