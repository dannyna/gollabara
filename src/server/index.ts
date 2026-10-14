// `golla serve` — 결과물을 받아 저장하고 열린 모든 화면에 흘린다.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dataDir, serverPort } from '../shared/config'
import type { IncomingEvent, ServerFrame } from '../shared/types'
import { Store } from './store'

const WEB_DIST = resolve(import.meta.dir, '../../web/dist')
const TOPIC = 'stream'

export function startServer() {
  const store = new Store(dataDir())

  const server = Bun.serve({
    port: serverPort(),
    // 같은 네트워크 · tailnet 기기에서도 열 수 있게 모든 인터페이스에서 듣는다
    hostname: '0.0.0.0',
    async fetch(req, srv) {
      const url = new URL(req.url)

      if (url.pathname === '/ws') {
        return srv.upgrade(req) ? undefined : new Response('upgrade failed', { status: 400 })
      }

      if (url.pathname === '/api/events' && req.method === 'POST') {
        const event = await req.json() as IncomingEvent
        const message = store.add(event)
        if (message)
          srv.publish(TOPIC, JSON.stringify({ type: 'message', message } satisfies ServerFrame))
        return Response.json({ ok: true, id: message?.id ?? null })
      }

      if (url.pathname === '/api/messages')
        return Response.json(store.recent())

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
        ws.send(JSON.stringify({ type: 'hello', messages: store.recent() } satisfies ServerFrame))
      },
      message() {},
    },
  })

  console.log(`gollabara 가 http://localhost:${server.port} 에서 구경 중입니다`)
  return server
}

function serveWeb(pathname: string): Response {
  if (!existsSync(WEB_DIST))
    return new Response('web/dist 가 없습니다. `bun run build:web` 또는 `bun run dev:web` 을 쓰세요.', { status: 503 })
  const safe = pathname.replace(/\.\.+/g, '')
  const file = Bun.file(join(WEB_DIST, safe === '/' ? 'index.html' : safe))
  return new Response(file.size > 0 ? file : Bun.file(join(WEB_DIST, 'index.html')))
}
