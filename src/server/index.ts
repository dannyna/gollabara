// `golla serve` — receives artifacts, stores them, and streams them to every open view.

import type { Server } from 'bun'
import type { Feedback, FeedbackClaim, FeedbackRequest, FeedbackVia, IncomingEvent, ServerFrame, ServerSettings, Session, TriageEngine } from '../shared/types'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dataDir, serverPort } from '../shared/config'
import { CHANNEL_GRACE_MS, ChannelLiveness } from './channel'
import { FeedbackError, Store, TRIAGE_ENGINES } from './store'
import { Triager } from './triage'
import { isTrustedSource } from './trusted'

const WEB_DIST = resolve(import.meta.dir, '../../web/dist')
const TOPIC = 'stream'
const VIAS: FeedbackVia[] = ['post-tool-use', 'stop', 'user-prompt-submit']
/** How long a channel poll waits for feedback before it returns empty and the channel server asks again */
const CHANNEL_WAIT_MS = 25_000

export function startServer() {
  const store = new Store(dataDir())
  const channels = new ChannelLiveness()
  const withChannel = (session: Session): Session => channels.isLive(session.id) ? { ...session, channel: true } : session
  // Set once the server is up; verdicts go out on the same topic as messages
  let publish: (frame: ServerFrame) => void = () => {}
  const triager = new Triager(store, triage => publish({ type: 'triage', triage }), {
    dataDir: dataDir(),
    selfUrl: `http://127.0.0.1:${serverPort()}`,
  })

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
        const relinked = event.kind === 'session' && event.pid ? store.sessionForPid(event.pid) : null
        const { session, message, created } = store.ingest(event)
        // The process moved to a new session (/clear, resume): its channel's open poll asks again for the new one
        if (relinked && relinked !== session.id)
          channels.wake(relinked)
        channels.observe(session.id, { event: event.kind })
        srv.publish(TOPIC, JSON.stringify({ type: 'session', session: withChannel(session) } satisfies ServerFrame))
        if (message)
          srv.publish(TOPIC, JSON.stringify({ type: created ? 'message' : 'message-upsert', message } satisfies ServerFrame))
        // Queued, never awaited: the model never holds up ingestion
        triager.onIngest(event, { session, message, created })
        return Response.json({ ok: true, id: message?.id ?? null })
      }

      if (url.pathname === '/api/settings') {
        if (req.method === 'GET')
          return Response.json(store.settings())
        if (req.method === 'PUT') {
          // Turning triage on makes this machine run a CLI: loopback and tailnet only, like feedback
          if (!isTrustedSource(srv.requestIP(req)?.address))
            return new Response('forbidden', { status: 403 })
          const body = await req.json().catch(() => null) as Partial<ServerSettings> | null
          if (!TRIAGE_ENGINES.includes(body?.triage as TriageEngine))
            return new Response('triage must be off, claude or codex', { status: 400 })
          const engine = body!.triage!
          if (engine !== 'off' && !Bun.which(engine))
            return new Response(`${engine} is not installed`, { status: 409 })
          const settings = store.saveSettings({ triage: engine })
          triager.onSettings(engine)
          srv.publish(TOPIC, JSON.stringify({ type: 'settings', settings } satisfies ServerFrame))
          return Response.json(settings)
        }
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
            channels.wake(feedback.sessionId)
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
          channels.observe(body.sessionId, { claim: body.via as FeedbackVia, claimed: items.length })
          for (const feedback of items) publishFeedback(srv, 'delivered', feedback)
          return Response.json(items)
        }
      }

      // A channel server long-polls for its session's feedback. It knows only its parent pid, which the
      // session's SessionStart linked. Claims share the hook's atomic claim, so each item goes out once.
      // It claims only while the session is idle: mid-turn, the hook hands feedback over at the next
      // tool call or Stop, where a channel event would wait for the next turn.
      if (url.pathname === '/api/channel/wait' && req.method === 'GET') {
        if (!isTrustedSource(srv.requestIP(req)?.address))
          return new Response('forbidden', { status: 403 })
        const pid = Number(url.searchParams.get('pid'))
        if (!Number.isInteger(pid) || pid <= 0)
          return new Response('pid is required', { status: 400 })
        const sessionId = store.sessionForPid(pid)
        // SessionStart has not arrived yet: the channel server retries
        if (!sessionId)
          return new Response('unknown pid', { status: 404 })
        srv.timeout(req, 0)
        const wasLive = channels.isLive(sessionId)
        channels.begin(sessionId)
        if (!wasLive)
          publishSession(sessionId)
        try {
          const claim = () => {
            if (!channels.isIdle(sessionId))
              return []
            const claimed = store.claimFeedback(sessionId, 'channel')
            channels.observe(sessionId, { claim: 'channel', claimed: claimed.length })
            return claimed
          }
          let items = claim()
          // Woken by new feedback, by the session turning idle, or by a relink; keeps waiting while busy
          for (let left = CHANNEL_WAIT_MS, start = Date.now(); !items.length && left > 0 && !req.signal.aborted; left = CHANNEL_WAIT_MS - (Date.now() - start)) {
            await channels.wait(sessionId, left, req.signal)
            // A client that went away would drop what it claimed
            if (!req.signal.aborted)
              items = claim()
            if (store.sessionForPid(pid) !== sessionId)
              break
          }
          for (const feedback of items) publishFeedback(srv, 'delivered', feedback)
          return Response.json(items)
        }
        finally {
          channels.end(sessionId)
          // Tell the views once the grace period runs out without another poll
          setTimeout(() => {
            if (!channels.isLive(sessionId))
              publishSession(sessionId)
          }, CHANNEL_GRACE_MS + 100)
        }
      }

      if (url.pathname === '/api/messages')
        return Response.json(store.recent())

      if (url.pathname === '/api/sessions')
        return Response.json(store.sessions().map(withChannel))

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
        const messages = store.recent()
        ws.send(JSON.stringify({
          type: 'hello',
          messages,
          sessions: store.sessions().map(withChannel),
          feedback: store.recentFeedback(),
          triage: store.triageFor(messages.map(m => m.id)),
          settings: store.settings(),
        } satisfies ServerFrame))
      },
      message() {},
    },
  })

  publish = frame => server.publish(TOPIC, JSON.stringify(frame))
  function publishSession(id: string) {
    const session = store.session(id)
    if (session)
      publish({ type: 'session', session: withChannel(session) })
  }
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
