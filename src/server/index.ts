// `golla serve` — receives artifacts, stores them, and streams them to every open view.

import type { Server, ServerWebSocket } from 'bun'
import type { Feedback, FeedbackClaim, FeedbackRequest, FeedbackVia, Harness, Health, IncomingEvent, ServerFrame, ServerSettings, Session, TriageEngine } from '../shared/types'
import { existsSync } from 'node:fs'
import { hostname, networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { dataDir, serverPort } from '../shared/config'
import { packageRoot } from '../shared/package-root'
import { HOOK_HARNESS_HEADER, HOOK_VERSION_HEADER, PLUGIN_VERSION } from '../shared/version'
import { CHANNEL_GRACE_MS, ChannelLiveness } from './channel'
import { allowRequest, listenHosts } from './listen'
import { SCHEMA_VERSION } from './migrations'
import { allowedHosts, refuseRequest } from './origin'
import { FeedbackError, Store, TRIAGE_ENGINES } from './store'
import { Triager } from './triage'
import { isTrustedSource } from './trusted'

// src/server in a checkout, dist/ in the bundle that npm and `golla setup` ship
const WEB_DIST = join(packageRoot(import.meta.dir) ?? resolve(import.meta.dir, '../..'), 'web/dist')
const TOPIC = 'stream'
const VIAS: FeedbackVia[] = ['post-tool-use', 'stop', 'user-prompt-submit']
/** How long a wake-up poll waits for feedback before it returns empty and the waiting hook asks again */
const CHANNEL_WAIT_MS = 25_000
const HARNESSES: Harness[] = ['claude-code', 'open-design', 'codex', 'claude-design']

export function startServer() {
  const store = new Store(dataDir())
  const channels = new ChannelLiveness()
  const withChannel = (session: Session): Session => channels.isLive(session.id) ? { ...session, channel: true } : session
  const listen = listenHosts(process.env.GOLLABARA_HOST, networkInterfaces())
  const hosts = allowedHosts(listen.hosts, networkInterfaces(), hostname(), process.env.GOLLABARA_ALLOWED_HOSTS)
  // One listener per address; every frame goes out on each of them, so all views get it
  const servers: Server<undefined>[] = []
  const publish = (frame: ServerFrame) => {
    const data = JSON.stringify(frame)
    for (const server of servers) server.publish(TOPIC, data)
  }
  const triager = new Triager(store, triage => publish({ type: 'triage', triage }), {
    dataDir: dataDir(),
    selfUrl: `http://127.0.0.1:${serverPort()}`,
  })

  /**
   * Records which hook version a harness runs. Hooks from before the handshake send no headers; their
   * harness comes from the event or the session, and the version is recorded as missing.
   */
  const seeHook = (req: Request, fallback: Harness | undefined) => {
    const named = req.headers.get(HOOK_HARNESS_HEADER) as Harness | null
    const harness = named && HARNESSES.includes(named) ? named : fallback
    if (harness)
      store.seeHook(harness, req.headers.get(HOOK_VERSION_HEADER)?.slice(0, 64) || null)
  }

  const handlers = {
    async fetch(req: Request, srv: Server<undefined>) {
      // Only this machine and the tailnet get an answer, whichever address the request came in on
      if (!allowRequest(srv.requestIP(req)?.address, listen.explicit))
        return new Response('forbidden', { status: 403 })
      const url = new URL(req.url)
      // Loopback is not enough: a page in this machine's browser comes from loopback too (rebinding, cross-site POSTs)
      const refused = refuseRequest({ method: req.method, pathname: url.pathname, headers: req.headers }, hosts)
      if (refused)
        return new Response(refused === 415 ? 'content-type must be application/json' : 'forbidden', { status: refused })

      if (url.pathname === '/ws') {
        return srv.upgrade(req) ? undefined : new Response('upgrade failed', { status: 400 })
      }

      if (url.pathname === '/api/events' && req.method === 'POST') {
        const event = await req.json() as IncomingEvent
        const relinked = event.kind === 'session' && event.pid ? store.sessionForPid(event.pid) : null
        const { session, message, created } = store.ingest(event)
        seeHook(req, session.harness)
        // The process moved to a new session (/clear, resume): its wake-up waiter's open poll returns and retires
        if (relinked && relinked !== session.id)
          channels.wake(relinked)
        channels.observe(session.id, event.kind === 'session' ? { event: event.kind, reason: event.reason } : { event: event.kind })
        publish({ type: 'session', session: withChannel(session) })
        if (message)
          publish({ type: created ? 'message' : 'message-upsert', message })
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
          publish({ type: 'settings', settings })
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
            publishFeedback('queued', feedback)
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
          seeHook(req, store.session(body.sessionId)?.harness)
          const items = store.claimFeedback(body.sessionId, body.via as FeedbackVia)
          channels.observe(body.sessionId, { claim: body.via as FeedbackVia, claimed: items.length })
          for (const feedback of items) publishFeedback('delivered', feedback)
          return Response.json(items)
        }
      }

      // A wake-up Stop hook long-polls for its session's feedback, keyed by the session id it was given.
      // Claims share the hook's atomic claim, so each item goes out once. It claims only while the session
      // is idle: mid-turn, the hook hands feedback over at the next tool call or Stop.
      // It gets 410 once it should exit: a newer Stop's waiter took over, the user started a turn, or its
      // process (`pid`) moved to another session (/clear), which it would otherwise wake with the old session's feedback.
      if (url.pathname === '/api/channel/wait' && req.method === 'GET') {
        if (!isTrustedSource(srv.requestIP(req)?.address))
          return new Response('forbidden', { status: 403 })
        const pid = Number(url.searchParams.get('pid'))
        const sessionId = url.searchParams.get('session')
        const waiter = Number(url.searchParams.get('waiter'))
        if (!sessionId || !(waiter > 0))
          return new Response('session and waiter are required', { status: 400 })
        seeHook(req, store.session(sessionId)?.harness)
        const moved = () => pid > 0 && (store.sessionForPid(pid) ?? sessionId) !== sessionId
        const retired = () => channels.retired(sessionId, waiter) ?? (moved() ? 'moved' : null)
        channels.enlist(sessionId, waiter)
        srv.timeout(req, 0)
        const wasLive = channels.isLive(sessionId)
        channels.begin(sessionId)
        if (!wasLive)
          publishSession(sessionId)
        try {
          const claim = () => {
            if (!channels.isIdle(sessionId) || retired())
              return []
            const claimed = store.claimFeedback(sessionId, 'rewake')
            channels.observe(sessionId, { claim: 'rewake', claimed: claimed.length })
            return claimed
          }
          let items = claim()
          // Woken by new feedback, by the session turning idle or busy, or by a relink; keeps waiting while busy
          for (let left = CHANNEL_WAIT_MS, start = Date.now(); !items.length && !retired() && left > 0 && !req.signal.aborted; left = CHANNEL_WAIT_MS - (Date.now() - start)) {
            await channels.wait(sessionId, left, req.signal)
            // A client that went away would drop what it claimed
            if (!req.signal.aborted)
              items = claim()
            if (moved())
              break
          }
          for (const feedback of items) publishFeedback('delivered', feedback)
          const reason = items.length ? null : retired()
          if (reason)
            return new Response(reason, { status: 410 })
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

      // For the UI and `golla doctor`: the plugin version this server expects and the hooks it has heard from
      if (url.pathname === '/api/health')
        return Response.json({ version: PLUGIN_VERSION, schema: SCHEMA_VERSION, hooks: store.hooks() } satisfies Health)

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
      open(ws: ServerWebSocket<undefined>) {
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
  }

  for (const [i, hostname] of listen.hosts.entries()) {
    try {
      servers.push(Bun.serve({ port: serverPort(), hostname, ...handlers }))
    }
    catch (error) {
      // The first address (loopback by default) must bind; a tailnet address that went away must not stop the server
      if (i === 0)
        throw error
      console.warn(`gollabara could not listen on ${hostname}: ${error instanceof Error ? error.message : error}`)
    }
  }
  function publishFeedback(status: 'queued' | 'delivered', feedback: Feedback) {
    publish({ type: 'feedback', status, feedback })
  }
  function publishSession(id: string) {
    const session = store.session(id)
    if (session)
      publish({ type: 'session', session: withChannel(session) })
  }
  for (const server of servers)
    console.log(`gollabara is watching at ${server.url.href.replace(/\/$/, '')}`)
  return servers
}

function serveWeb(pathname: string): Response {
  if (!existsSync(WEB_DIST))
    return new Response('web/dist is missing. Use `bun run build:web` or `bun run dev:web`.', { status: 503 })
  const safe = pathname.replace(/\.{2,}/g, '')
  const file = Bun.file(join(WEB_DIST, safe === '/' ? 'index.html' : safe))
  return new Response(file.size > 0 ? file : Bun.file(join(WEB_DIST, 'index.html')))
}
