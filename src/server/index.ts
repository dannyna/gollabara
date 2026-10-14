// `golla serve` — receives artifacts, stores them, and streams them to every open view.

import type { Server } from 'bun'
import type { Feedback, FeedbackClaim, FeedbackRequest, FeedbackVia, IncomingEvent, ServerFrame } from '../shared/types'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dataDir, serverPort } from '../shared/config'
import { FeedbackError, Store } from './store'
import { isTrustedSource } from './trusted'

const WEB_DIST = resolve(import.meta.dir, '../../web/dist')
const TOPIC = 'stream'
const VIAS: FeedbackVia[] = ['post-tool-use', 'stop', 'user-prompt-submit']

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

      if (url.pathname.startsWith('/api/feedback') && req.method === 'POST') {
        // Feedback is text a running session will read: loopback and tailnet only (see #15)
        if (!isTrustedSource(srv.requestIP(req)?.address))
          return new Response('forbidden', { status: 403 })
        const body = await req.json().catch(() => null) as Partial<FeedbackRequest & FeedbackClaim> | null
        if (typeof body?.sessionId !== 'string' || !body.sessionId)
          return new Response('sessionId is required', { status: 400 })

        if (url.pathname === '/api/feedback') {
          if (typeof body.text !== 'string' || !body.text.trim())
            return new Response('text is required', { status: 400 })
          if (body.image !== undefined && typeof body.image !== 'string')
            return new Response('image must be a string', { status: 400 })
          try {
            const feedback = store.queueFeedback(body.sessionId, body.text, body.image || undefined)
            publishFeedback(srv, 'queued', feedback)
            return Response.json(feedback)
          }
          catch (error) {
            if (error instanceof FeedbackError)
              return new Response(error.message, { status: error.status })
            throw error
          }
        }

        if (url.pathname === '/api/feedback/claim') {
          if (!VIAS.includes(body.via as FeedbackVia))
            return new Response('via is invalid', { status: 400 })
          const items = store.claimFeedback(body.sessionId, body.via as FeedbackVia)
          for (const feedback of items) publishFeedback(srv, 'delivered', feedback)
          return Response.json(items)
        }
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
        ws.send(JSON.stringify({ type: 'hello', messages: store.recent(), sessions: store.sessions(), feedback: store.recentFeedback() } satisfies ServerFrame))
      },
      message() {},
    },
  })

  console.log(`gollabara is watching at http://localhost:${server.port}`)
  return server
}

function publishFeedback(srv: Server<undefined>, status: 'queued' | 'delivered', feedback: Feedback) {
  srv.publish(TOPIC, JSON.stringify({ type: 'feedback', status, feedback } satisfies ServerFrame))
}

function serveWeb(pathname: string): Response {
  if (!existsSync(WEB_DIST))
    return new Response('web/dist is missing. Use `bun run build:web` or `bun run dev:web`.', { status: 503 })
  const safe = pathname.replace(/\.{2,}/g, '')
  const file = Bun.file(join(WEB_DIST, safe === '/' ? 'index.html' : safe))
  return new Response(file.size > 0 ? file : Bun.file(join(WEB_DIST, 'index.html')))
}
