// `golla serve` — receives artifacts, stores them, and streams them to every open view.

import type { Server, ServerWebSocket } from 'bun'
import type { AnswerRequest, AnswerSetting, Feedback, FeedbackClaim, FeedbackQuote, FeedbackRequest, FeedbackVia, Harness, Health, HistoryPage, IncomingEvent, Question, ServerFrame, Session, SettingsPatch, TriageEngine } from '../shared/types'
import type { Purged } from './store'
import { existsSync } from 'node:fs'
import { hostname, networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { dataDir, serverPort } from '../shared/config'
import { quoteText } from '../shared/feedback'
import { packageRoot } from '../shared/package-root'
import { routesFor } from '../shared/routes'
import { HOOK_HARNESS_HEADER, HOOK_VERSION_HEADER, PLUGIN_VERSION } from '../shared/version'
import { CHANNEL_GRACE_MS, ChannelLiveness } from './channel'
import { EXPIRE_EVERY_MS, expiryCutoffs } from './expiry'
import { Holds } from './holds'
import { allowRequest, listenHosts } from './listen'
import { goneSessions, SWEEP_MS, systemProbe } from './liveness'
import { SCHEMA_VERSION } from './migrations'
import { allowedHosts, refuseRequest } from './origin'
import { loadVapidKeys, Pusher, sendPush, toSubscription } from './push'
import { ANSWER_SETTINGS, FeedbackError, Store, TRIAGE_ENGINES } from './store'
import { Triager } from './triage'
import { isTrustedSource } from './trusted'

// src/server in a checkout, dist/ in the bundle that npm and `golla setup` ship
const WEB_DIST = join(packageRoot(import.meta.dir) ?? resolve(import.meta.dir, '../..'), 'web/dist')
const TOPIC = 'stream'
/** Views from this machine or the tailnet, which may answer a held question; nothing is published to it */
const ANSWERING_TOPIC = 'answering'
const VIAS: FeedbackVia[] = ['post-tool-use', 'stop', 'user-prompt-submit']
/** How long a wake-up poll waits for feedback before it returns empty and the waiting hook asks again */
const CHANNEL_WAIT_MS = 25_000
const HARNESSES: Harness[] = ['claude-code', 'open-design', 'codex', 'claude-design']
const PHONE_MAX = 2048
/** Messages per history page by default, and at most */
const HISTORY_PAGE = 200
const HISTORY_MAX = 500

/** An integer query parameter within [min, max], or `fallback` when missing or not a number */
function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = raw === null || raw === '' ? Number.NaN : Number(raw)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback
}

/** The `before` cursor: a message id, or undefined for the latest page */
function historyBefore(params: URLSearchParams): number | undefined {
  const n = clampInt(params.get('before'), 0, Number.MAX_SAFE_INTEGER, -1)
  return n >= 0 ? n : undefined
}

export function startServer() {
  const store = new Store(dataDir())
  const channels = new ChannelLiveness()
  // Each session carries its delivery routes; `channel` stays for views from before routes.
  // An ended session has none: a waiter's grace period must not read as 「바로 전달돼요」
  const withChannel = (session: Session): Session => {
    if (session.endedAt)
      return { ...session, routes: [] }
    const live = channels.isLive(session.id)
    return { ...session, ...(live ? { channel: true } : {}), routes: routesFor(session.harness, live), state: channels.state(session.id) }
  }
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
  // Created on first use, once, in the data directory
  let vapid: ReturnType<typeof loadVapidKeys> | null = null
  const vapidKeys = () => vapid ??= loadVapidKeys(dataDir())
  const pusher = new Pusher(store, async (sub, payload) => sendPush(sub, payload, await vapidKeys()))
  // Views learn when a question can be answered from the app, and when it no longer can
  const holds = new Holds((hold, live) => publish({ type: 'hold', sessionId: hold.sessionId, questionId: hold.questionId, until: live ? hold.until : null, now: Date.now() }))
  /**
   * Open views on every listener that could answer: a hold waits only for one. With GOLLABARA_HOST a LAN view
   * may watch, but /api/questions/answer refuses it, so it does not count
   */
  const viewers = () => servers.reduce((n, server) => n + server.subscriberCount(ANSWERING_TOPIC), 0)

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
        // Any event but session-end can link the pid (store.ingest), a late one too when the SessionStart was lost
        const relinked = event.kind !== 'session-end' && event.pid ? store.sessionForPid(event.pid) : null
        const { session, message, created } = store.ingest(event)
        seeHook(req, session.harness)
        // The process moved to a new session (/clear, resume): its wake-up waiter's open poll returns and retires
        // The session that held the pid ended with it (store.ingest)
        if (relinked && relinked !== session.id) {
          channels.wake(relinked)
          publishSession(relinked)
        }
        // A waiter still polling for an ended session returns and retires
        if (event.kind === 'session-end')
          channels.wake(session.id)
        channels.observe(session.id, event.kind === 'session' ? { event: event.kind, reason: event.reason } : { event: event.kind })
        publish({ type: 'session', session: withChannel(session) })
        if (message)
          publish({ type: created ? 'message' : 'message-upsert', message })
        // Queued, never awaited: the model never holds up ingestion
        triager.onIngest(event, { session, message, created })
        // Background too: a slow push service never holds up ingestion
        pusher.onIngest(event)
        return Response.json({ ok: true, id: message?.id ?? null })
      }

      if (url.pathname === '/api/settings') {
        if (req.method === 'GET')
          return Response.json(store.settings())
        if (req.method === 'PUT') {
          // Turning triage on makes this machine run a CLI: loopback and tailnet only, like feedback
          if (!isTrustedSource(srv.requestIP(req)?.address))
            return new Response('forbidden', { status: 403 })
          const body = await req.json().catch(() => null) as SettingsPatch | null
          const invalid = settingsError(body)
          if (invalid)
            return new Response(invalid, { status: 400 })
          // A key from an older client (`retention`, #116) is ignored, never an error
          const { triage: engine, phone, answer, seed } = body!
          const previous = store.settings().triage
          if (engine && engine !== 'off' && engine !== previous && !Bun.which(engine))
            return new Response(`${engine} is not installed`, { status: 409 })
          const settings = store.saveSettings({ triage: engine, phone: phone?.trim(), answer }, seed === true)
          if (settings.triage !== previous)
            triager.onSettings(settings.triage)
          // Holds open under the old value would keep their terminals waiting and still take the app's answer
          if (settings.answer !== 'on')
            holds.releaseAll()
          publish({ type: 'settings', settings })
          return Response.json(settings)
        }
      }

      // 「이 세션 데이터 삭제」: removes rows and files, so only this machine and the tailnet, like settings
      if (url.pathname.startsWith('/api/sessions/') && req.method === 'DELETE') {
        if (!isTrustedSource(srv.requestIP(req)?.address))
          return new Response('forbidden', { status: 403 })
        const id = decodeURIComponent(url.pathname.slice('/api/sessions/'.length))
        if (!id)
          return new Response('session id is required', { status: 400 })
        const purged = store.deleteSession(id)
        publishPurged(purged)
        return Response.json({ ok: true, messages: purged.messageIds.length, files: purged.files.length })
      }

      // Web Push: the device asks for the key it subscribes with, then hands its subscription over
      if (url.pathname === '/api/push/key' && req.method === 'GET')
        return Response.json({ publicKey: (await vapidKeys()).publicKey })

      if (url.pathname === '/api/push/subscribe' && (req.method === 'POST' || req.method === 'DELETE')) {
        // Like settings: only this machine and the tailnet may add a device that hears from it
        if (!isTrustedSource(srv.requestIP(req)?.address))
          return new Response('forbidden', { status: 403 })
        const body = await req.json().catch(() => null) as { endpoint?: unknown } | null
        if (req.method === 'DELETE') {
          if (typeof body?.endpoint !== 'string')
            return new Response('endpoint is required', { status: 400 })
          store.deletePushSubscription(body.endpoint)
          return Response.json({ ok: true })
        }
        const sub = toSubscription(body)
        if (!sub)
          return new Response('a push subscription is required', { status: 400 })
        store.savePushSubscription(sub)
        return Response.json({ ok: true })
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
          let quote: FeedbackQuote | undefined
          if (body.quote !== undefined) {
            const { text, at } = (body.quote ?? {}) as Partial<FeedbackQuote>
            quote = typeof text === 'string' && Number.isFinite(at) ? { text: quoteText(text), at: at! } : undefined
            if (!quote?.text)
              return new Response('quote needs text and at', { status: 400 })
          }
          try {
            const feedback = store.queueFeedback(body.sessionId, body.text, body.image || undefined, Date.now(), quote)
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

        // The user drops items still queued, e.g. for a session that ended; delivered ones are never taken back
        if (url.pathname === '/api/feedback/discard') {
          const ids = (body as { ids?: unknown }).ids
          if (ids !== undefined && !(Array.isArray(ids) && ids.every(Number.isInteger)))
            return new Response('ids must be integers', { status: 400 })
          const purged = store.discardFeedback(body.sessionId, ids as number[] | undefined)
          publishPurged(purged)
          return Response.json({ ok: true, feedbackIds: purged.feedbackIds })
        }

        if (url.pathname === '/api/feedback/claim') {
          if (!VIAS.includes(body.via as FeedbackVia))
            return new Response('via is invalid', { status: 400 })
          seeHook(req, store.session(body.sessionId)?.harness)
          const items = store.claimFeedback(body.sessionId, body.via as FeedbackVia)
          // Every tool call claims: a frame goes out only when the state it shows changed
          if (channels.observe(body.sessionId, { claim: body.via as FeedbackVia, claimed: items.length }))
            publishSession(body.sessionId)
          for (const feedback of items) publishFeedback('delivered', feedback)
          return Response.json(items)
        }
      }

      // The `ask` hook (PreToolUse on AskUserQuestion) holds the session's question for the app to answer.
      // It waits only with 「앱에서 답하기」 on and a view open, and only for a live Claude Code session;
      // otherwise `{ hold: false }` at once, and the terminal shows its dialog. Esc or the hook's timeout aborts
      // the request, which drops the hold.
      if (url.pathname === '/api/questions/hold' && req.method === 'POST') {
        if (!isTrustedSource(srv.requestIP(req)?.address))
          return new Response('forbidden', { status: 403 })
        const body = await req.json().catch(() => null) as { sessionId?: unknown, questionId?: unknown, questions?: unknown } | null
        const questions = heldQuestions(body?.questions)
        if (typeof body?.sessionId !== 'string' || !body.sessionId || typeof body.questionId !== 'string' || !body.questionId || !questions)
          return new Response('sessionId, questionId and questions are required', { status: 400 })
        const session = store.session(body.sessionId)
        seeHook(req, session?.harness)
        if (store.settings().answer !== 'on' || viewers() === 0 || session?.endedAt || (session && session.harness !== 'claude-code'))
          return Response.json({ hold: false })
        // The decision goes out at once (headers and a first byte), inside the hook's 1.5 s budget; the answer
        // follows in the body. No idle timeout: the body says nothing more for up to ANSWER_HOLD_MS
        srv.timeout(req, 0)
        const { sessionId, questionId } = body
        return heldResponse(signal => holds.hold(sessionId, questionId, questions, signal), req.signal)
      }

      // The app answers a held question. Only while the hold is live: an expired, answered or unknown one is 409
      if (url.pathname === '/api/questions/answer' && req.method === 'POST') {
        // Like feedback: the text reaches a running session
        if (!isTrustedSource(srv.requestIP(req)?.address))
          return new Response('forbidden', { status: 403 })
        const body = await req.json().catch(() => null) as Partial<AnswerRequest> | null
        if (typeof body?.sessionId !== 'string' || !body.sessionId || typeof body.questionId !== 'string' || !body.questionId)
          return new Response('sessionId and questionId are required', { status: 400 })
        const result = holds.answer(body.sessionId, body.questionId, body.answers)
        if (result.status === 'closed')
          return Response.json({ error: 'closed' }, { status: 409 })
        if (result.status === 'invalid')
          return new Response(result.error, { status: 400 })
        const message = store.recordAnswer(body.sessionId, body.questionId, result.answers, 'app')
        if (message)
          publish({ type: 'message-upsert', message })
        return Response.json({ ok: true, answers: result.answers })
      }

      // A wake-up Stop hook long-polls for its session's feedback, keyed by the session id it was given.
      // Claims share the hook's atomic claim, so each item goes out once. It claims only while the session
      // is idle: mid-turn, the hook hands feedback over at the next tool call or Stop.
      // It gets 410 once it should exit: a newer Stop's waiter took over, the user started a turn, or its
      // process (`pid`) moved to another session (/clear), which it would otherwise wake with the old session's feedback,
      // or the session ended.
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
        const retired = () => channels.retired(sessionId, waiter) ?? (moved() ? 'moved' : null) ?? (store.session(sessionId)?.endedAt ? 'ended' : null)
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
            if (channels.observe(sessionId, { claim: 'rewake', claimed: claimed.length }))
              publishSession(sessionId)
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
          // Tell the views once the grace period runs out without another poll. Late, so a store closed since
          // (a stopped test server) only costs that frame; unref'd, so it never keeps the process alive
          setTimeout(() => {
            try {
              if (!channels.isLive(sessionId))
                publishSession(sessionId)
            }
            catch {}
          }, CHANNEL_GRACE_MS + 100).unref()
        }
      }

      // For the UI and `golla doctor`: the plugin version this server expects and the hooks it has heard from
      if (url.pathname === '/api/health')
        return Response.json({ version: PLUGIN_VERSION, schema: SCHEMA_VERSION, hooks: store.hooks() } satisfies Health)

      if (url.pathname === '/api/messages')
        return Response.json(store.recent())

      // Older messages than the hello sent (#77), for scrolling up within the loaded run
      if (url.pathname === '/api/history')
        return Response.json(store.history(historyBefore(url.searchParams), clampInt(url.searchParams.get('limit'), 1, HISTORY_MAX, HISTORY_PAGE)) satisfies HistoryPage)

      if (url.pathname === '/api/sessions')
        return Response.json(store.sessions().map(withChannel))

      if (url.pathname.startsWith('/img/')) {
        const file = Bun.file(join(store.imageDir, url.pathname.slice('/img/'.length).replace(/[^\w.]/g, '')))
        return (await file.exists())
          ? new Response(file, { headers: { 'cache-control': 'public, max-age=31536000, immutable' } })
          : new Response('not found', { status: 404 })
      }

      // An API path nothing answered (a removed route such as /api/history/days) is not the app's page
      if (url.pathname.startsWith('/api/'))
        return new Response('not found', { status: 404 })

      return serveWeb(url.pathname)
    },
    websocket: {
      open(ws: ServerWebSocket<undefined>) {
        ws.subscribe(TOPIC)
        if (isTrustedSource(ws.remoteAddress))
          ws.subscribe(ANSWERING_TOPIC)
        const messages = store.recent()
        ws.send(JSON.stringify({
          type: 'hello',
          messages,
          older: messages.length > 0 && store.hasOlder(messages[0]!.id),
          sessions: store.sessions().map(withChannel),
          feedback: store.recentFeedback(),
          triage: store.triageFor(messages.map(m => m.id)),
          settings: store.settings(),
          holds: holds.active(),
          now: Date.now(),
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
    if (status === 'delivered')
      pusher.onDelivered(feedback.sessionId, feedback.deliveredVia!)
  }
  function publishPurged({ messageIds, feedbackIds, sessionIds }: Purged) {
    if (messageIds.length || feedbackIds.length || sessionIds.length)
      publish({ type: 'deleted', messageIds, feedbackIds, sessionIds })
  }
  // Ended sessions expire an hour after they end (#116)
  function expire() {
    try {
      const { endedBefore, cacheBefore } = expiryCutoffs(Date.now())
      publishPurged(store.expire(endedBefore, cacheBefore))
    }
    catch (error) {
      console.warn(`gollabara could not expire sessions: ${error instanceof Error ? error.message : error}`)
    }
  }
  expire()
  // unref: the timer alone never keeps the process (or a test run) alive
  setInterval(expire, EXPIRE_EVERY_MS).unref()
  function publishSession(id: string) {
    const session = store.session(id)
    if (session)
      publish({ type: 'session', session: withChannel(session) })
  }
  // A session whose process went away sends no session-end: check the linked pids now and every SWEEP_MS
  const sweep = () => {
    try {
      for (const session of store.endSessions(goneSessions(store.pidLinks(), systemProbe))) {
        channels.wake(session.id)
        publish({ type: 'session', session: withChannel(session) })
      }
    }
    catch (error) {
      console.warn(`gollabara could not check sessions: ${error instanceof Error ? error.message : error}`)
    }
  }
  sweep()
  setInterval(sweep, SWEEP_MS).unref()
  for (const server of servers)
    console.log(`gollabara is watching at ${server.url.href.replace(/\/$/, '')}`)
  return servers
}

/** Why a settings patch is invalid, or null. Every key is optional; those present must be valid. */
function settingsError(body: SettingsPatch | null): string | null {
  if (!body || typeof body !== 'object')
    return 'a settings object is required'
  if (body.triage !== undefined && !TRIAGE_ENGINES.includes(body.triage as TriageEngine))
    return 'triage must be off, claude or codex'
  if (body.answer !== undefined && !ANSWER_SETTINGS.includes(body.answer as AnswerSetting))
    return 'answer must be on or off'
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string' || body.phone.length > PHONE_MAX)
      return 'phone must be a string'
    const phone = body.phone.trim()
    if (phone && !URL.canParse(phone))
      return 'phone must be an https address'
    if (phone && new URL(phone).protocol !== 'https:')
      return 'phone must be an https address'
  }
  return null
}

/** The questions a hold names (only their texts matter here), or null when they are not a list of questions */
function heldQuestions(raw: unknown): Question[] | null {
  if (!Array.isArray(raw) || !raw.length || !raw.every(q => typeof q?.question === 'string' && q.question))
    return null
  return raw as Question[]
}

/**
 * A hold's response: a space flushed at once, so the hook knows the hold began, then the JSON once it ends
 * (leading whitespace is valid JSON). The hold ends when the hook's request goes away, by its signal or the
 * stream's cancel, whichever Bun reports.
 */
function heldResponse(wait: (signal: AbortSignal) => Promise<Record<string, string> | null>, request: AbortSignal): Response {
  const gone = new AbortController()
  request.addEventListener('abort', () => gone.abort(), { once: true })
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(' '))
      void wait(gone.signal).then((answers) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(answers ? { answers } : { hold: false })))
          controller.close()
        }
        catch {
          // The hook went away first
        }
      })
    },
    cancel() {
      gone.abort()
    },
  }), { headers: { 'content-type': 'application/json' } })
}

function serveWeb(pathname: string): Response {
  if (!existsSync(WEB_DIST))
    return new Response('web/dist is missing. Use `bun run build:web` or `bun run dev:web`.', { status: 503 })
  const safe = pathname.replace(/\.{2,}/g, '')
  const file = Bun.file(join(WEB_DIST, safe === '/' ? 'index.html' : safe))
  const found = file.size > 0
  // The page, the manifest and the service worker are checked on every load, so a new build
  // reaches the installed app; hashed assets keep the browser's usual caching
  const headers: Record<string, string> = {}
  if (!found || /^\/(?:index\.html|sw\.js|manifest\.webmanifest)?$/.test(safe))
    headers['cache-control'] = 'no-cache'
  if (safe === '/sw.js')
    headers['content-type'] = 'text/javascript; charset=utf-8'
  if (safe === '/manifest.webmanifest')
    headers['content-type'] = 'application/manifest+json'
  return new Response(found ? file : Bun.file(join(WEB_DIST, 'index.html')), { headers })
}
