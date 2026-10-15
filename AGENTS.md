# AGENTS.md

A guide for agents (and people) working in this repository: product invariants, code layout, commands, and conventions. Read [README.md](README.md) for why the product looks the way it does and [DESIGN.md](DESIGN.md) for the visual rules, and [docs/ROADMAP.md](docs/ROADMAP.md) for what comes next.

## Invariants

1. **Observer, not mediator.** gollabara never originates messages or questions and never asks a session for approval. Mirror only the session's own questions (`AskUserQuestion`, Codex's `request_user_input`). The one thing it sends to a session is feedback the user writes, delivered as-is. Answering `AskUserQuestion` and pausing a session remain out of scope. No dedicated `post` / `ask` tools for agents to decide what to send: the plugin exposes no tools. Triage only decides which chat lines the user sees, and with which state; it never writes to a session, so only what the user sends reaches one.
2. **The hook never blocks a session.** 1.5 s timeout for its requests and a 2.5 s hard deadline for the whole run, swallow every error, always exit 0. If the server is down, exit quietly. The one long-running hook, the wake-up Stop hook (`hook.js wait`), runs in the background (`asyncRewake`), so the session never waits on it; it exits 2 only to wake an idle session with the user's feedback.
3. **Only artifacts flow.** Never mirror full transcripts. The units are images, one-line recaps, and questions.
4. **Never judge artifacts.** The server and the UI show received images as-is. No scoring, server-side screenshots, or diffing of images. A perceptual hash (dHash) is used only to group near-identical re-captures of one file (`src/shared/stacks.ts`); it is never shown and never used to judge an image. Triage of chat text (whether a recap line is shown, and its state) is allowed, opt-in, and off by default. Previewing HTML artifacts is a possible future capability, not a prohibition; it is out of the current scope.
5. **Local only.** Data lives in local SQLite and image files. No third-party storage, no public internet exposure. The one exception is opt-in: with triage on, recap and question text, and the text of the user's latest feedback to that session, go to the model behind the user's own `claude` or `codex` CLI. Images never do. The one other exception is also opt-in, per device: a Web Push ping, encrypted end to end, that carries no session text, name or image. It travels through the browser vendor's push service (decision D1, #64).
6. **Multi-harness by design.** Claude Code (with the Open Design runs that go through it) and Codex CLI have adapters today, sharing one hook bundle. Antigravity, other harnesses and Claude Design follow after the MVP ([docs/ROADMAP.md](docs/ROADMAP.md)). Keep the event types in `src/shared/types.ts` free of Claude-Code-only concepts.

## Layout

| Path            | Role                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/cli.ts`    | `golla` CLI entry point (`serve`, `hook`, `doctor`, `setup`, `update`, `uninstall`)                         |
| `src/doctor.ts` | `golla doctor`: server reachability, plugin versions, hook health, then the machine checks                  |
| `src/setup/`    | `golla setup/update/uninstall`, the LaunchAgent, harness plugins (`codex.ts` renders Codex's hooks), checks |
| `src/hook/`     | Hook input → stream events. `map.ts` is pure; I/O lives in `index.ts`                                       |
| `src/server/`   | `golla serve`: SQLite, hash-named image storage, WebSocket fan-out                                          |
| `src/shared/`   | Types and config shared by the server, the hook, and the UI                                                 |
| `web/`          | Viewer UI (Vue 3 + Vite)                                                                                    |
| `plugin/`       | Claude Code plugin. `bin/hook.js` is a build output, but it is committed; Codex runs it too                 |
| `docs/`         | Architecture SVGs (from the Open Design `gollabara-architecture` project) and `ROADMAP.md`                  |
| `spike/`        | Early hook-input capture experiments, reference only                                                        |

## Commands

Use [bun](https://bun.sh) 1.3+ only; never npm, pnpm, or yarn.

```bash
bun install          # also installs the husky git hooks
bun run build        # bundle the hook and the CLI (dist/golla.js) + build the web UI
bun run dev          # server, restarts on file change
bun run dev:web      # web dev server (4748, proxies to 4747)
bun test             # every *.test.ts (hook, server, shared, web)
bun run typecheck
bun run lint         # ESLint (@antfu/eslint-config), also formats Markdown/JSON/YAML
bun run lint:fix
bun src/cli.ts doctor # server, plugin version per harness, hook health, service, plugins, sleep, Tailscale
```

`bun install` sets up husky git hooks: pre-commit runs lint-staged, and commit-msg runs commitlint.

After editing `src/hook/` or `src/shared/`, rebuild `plugin/bin/hook.js` with `bun run build:hook`, and commit it. The plugin is copied into a cache and runs from this file alone.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → web build, then checks that the committed `plugin/bin/hook.js` matches the source.

## Configuration

| Variable                  | Default                 | Description                                                                               |
| ------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `GOLLABARA_PORT`          | `4747`                  | Server port                                                                               |
| `GOLLABARA_HOST`          | unset                   | Comma-separated listen addresses (e.g. `0.0.0.0`); setting it also lifts the source check |
| `GOLLABARA_URL`           | `http://127.0.0.1:4747` | Server the hook posts events to and the wake-up hook polls                                |
| `GOLLABARA_DATA`          | `~/.gollabara/data`     | Where messages, images, and the hook health log are stored                                |
| `GOLLABARA_HOOK`          | unset                   | `off`: the hooks exit at once, posting and claiming nothing                               |
| `GOLLABARA_ALLOWED_HOSTS` | unset                   | Comma-separated extra host names the server answers to (e.g. a reverse proxy's name)      |
| `GOLLABARA_HOME`          | `~/.gollabara`          | Where `golla setup` installs the app (`app/`)                                             |
| `GOLLABARA_SERVICE_LABEL` | `dev.gollabara.server`  | The LaunchAgent label, and its plist name in `~/Library/LaunchAgents`                     |
| `GOLLABARA_CLAUDE`        | `claude`                | The Claude Code binary `golla setup`, `uninstall` and `doctor` run                        |
| `GOLLABARA_CODEX`         | `codex`                 | The Codex CLI binary `golla setup`, `uninstall` and `doctor` run                          |

`golla serve` listens on `127.0.0.1` plus each Tailscale address found on the network interfaces at start (`100.64.0.0/10`, `fd7a:115c:a1e0::/48`), one listener per address sharing the handlers and the WebSocket fan-out (`src/server/listen.ts`). A tailnet address that appears later is picked up on the next restart. Requests from any other source get 403 for every path. `GOLLABARA_HOST` replaces the addresses, and because it is the user's explicit opt-in, it also lifts that check; the feedback, settings and wake-up endpoints still accept only loopback and tailnet sources.

### Request checks

The source address is not enough: any web page open in this machine's browser also comes from loopback. `src/server/origin.ts` adds three checks to every request, whatever `GOLLABARA_HOST` says:

- **Host.** The `Host` header must be loopback (`localhost`, `127.0.0.1`, `[::1]`), a bound address (every interface address when the bind is a wildcard), a `.ts.net` name, this machine's hostname (with and without `.local`, or its first label), or a name in `GOLLABARA_ALLOWED_HOSTS`, with any port. Otherwise 403; this stops DNS rebinding.
- **Origin.** Mutations and the `/ws` upgrade get 403 when an `Origin` header names any other host (a `.ts.net` origin must equal the request's host), or when `Sec-Fetch-Site` is `cross-site`. Requests without `Origin` (the hook, curl) pass.
- **JSON.** Mutations under `/api/` need `Content-Type: application/json` (charset allowed), otherwise 415, so a page cannot send a preflight-free `text/plain` POST.

The vite dev server's proxy (`localhost:4748`) passes as loopback, so it needs no `changeOrigin`.

## Storage

`GOLLABARA_DATA` holds `stream.db` (SQLite, WAL) and `images/`. The schema is versioned with `PRAGMA user_version`: `src/server/migrations.ts` lists numbered migrations, and opening the store applies each one past the stored version in order, every one in its own transaction together with its version bump. Change the schema only by appending a migration; never edit a shipped one, and never add `CREATE TABLE IF NOT EXISTS` or column checks to `store.ts`. Migration 1 is the schema from before versioning: it brings any version-0 database, with or without the columns once added on open (`sessions.pid`, `triage.tone`), to that schema in place without losing rows. A database newer than the code is left as is. Migration 2 adds `hook_versions`, the latest hook seen per harness. Migration 4 adds `sessions.ended_at` and `sessions.pid_at` (see **Ended sessions**). Migration 5 adds `triage_cache.seen_at`, when each cached verdict was last written or used; rows from before it count as used at the upgrade. Migration 6 indexes `messages.at` and `json_extract(body, '$.sessionId')` for history (below).

It also holds `hook-health.jsonl`, the hook health log (see below). The hook writes it under its own `GOLLABARA_DATA`, so a session whose env doesn't match the server's logs elsewhere.

### Retention and deleting a session

「보관 기간」 (`retention`: `7`, `30` or `forever`) is a server setting (`src/server/retention.ts`). The server prunes at start, every hour, and right after the window changes: messages whose `at` is older than the window, feedback whose `created_at` is, the triage rows of those messages, sessions last seen before it, and cached hide verdicts (`triage_cache`) not written or used since it. A cache hit refreshes `seen_at`, so a line that keeps recurring stays cached. Deleting one session leaves the cache alone: its rows are normalized text shared by every session, with nothing that ties them to one. A window never chosen prunes nothing, so an upgrade deletes nothing until a device seeds the value it kept locally (see Settings). The settings sheet asks with the app's own `ConfirmDialog` (「줄이고 지우기」) before a shorter window is saved.

「이 세션 데이터 삭제」 in a session's avatar menu asks the same way, then sends `DELETE /api/sessions/<id>` (loopback and tailnet only, like settings). It removes the session record, its messages, its feedback, their triage rows and the image files no other row uses. A live session comes back with its next event.

Images are named by content hash, so one file can back several messages. Both paths (`Store.prune`, `Store.deleteSession`) delete rows in one transaction and collect the files those rows named. A file is unlinked only when no remaining message body names it (`"/img/<name>"`) and no remaining feedback row quotes it. The work is synchronous: ingest writes a file and inserts its message without yielding, so a prune can't remove a file a new message is about to use. Each deletion goes out as one `deleted` frame (`messageIds`, `feedbackIds`, `sessionIds`), and open views drop those rows; the viewer, the pin, the selection, a reply target and a scope that pointed at them let go.

### Settings

Every setting except the theme and the server address is stored on the server, in the `settings` key/value table, so the phone and the desktop agree: 「대화 정리」 (`triage`), 「보관 기간」 (`retention`) and 「폰용 주소」 (`phone`). `GET /api/settings` and the `hello` frame return them; a key never saved is absent. `PUT /api/settings` (loopback and tailnet only) takes any subset and validates each key it names (`phone` is https or empty); with `seed: true` it writes only keys that have no value yet. Every change goes out as a `settings` frame.

The settings used to live in this browser (`gollabara-settings`). After the first `hello`, a browser that still has `phone` or `retention` there sends them with `seed: true` and then keeps only `server`, so the first device seeds the server and a stale one never overwrites it. A kept window of 7 or 30 days was saved while the sheet promised to delete nothing, so it seeds only after that device confirms 「줄이고 지우기」; cancelling drops it and the server keeps everything. Per device by design: the theme (`gollabara-theme`), the server address, 「알림 받기」 (the browser's own push subscription), and view state (muted sessions, the pinned cell, captures split off with 「따로 보기」).

### History

The `hello` frame carries only the latest messages, with `older: true` when there are more. The UI holds one contiguous run of messages by id and pages it with `GET /api/history`:

- **Pages.** `?before=<id>` returns the page just older than that id, `?after=<id>` the page just newer, and `?from=<ms>` the page that starts at the first message at or after that time (a day jump). `limit` defaults to 200 and is capped at 500. The answer is `{ messages, triage, feedback, older, newer }`: the triage rows of those messages, and the feedback created between the page's first message and the next one, so a page brings its own bubbles.
- **Days.** `GET /api/history/days?tz=<minutes east of UTC>&session=<id>` lists `{ start, count }` for each local day with messages, newest first; `session` narrows it to one session. The client sends its current offset, so a day that crossed a DST change may be off by an hour at its edge.
- **Cost.** Paging walks the primary key; the day list and a day jump read `messages_at`, and a session's day list reads `messages_session` (migration 6). Neither reads a body to group or order.
- **Jumps.** A day already in the run only scrolls there. Otherwise the run is replaced by the day's page and stops short of the latest (`live: false`): live frames are buffered and counted instead of drawn, the stream footer reads 「지난 기록 · 최신으로 가면 다시 따라가요」, and both pills read 「최신으로」 (or 「새 메시지 n」 / 「새 산출물 n」). Paging newer until the run reaches the latest, or 「최신으로」, joins the live tail again. A jump lets go of the pin.
- **Loading.** The chat pages while the reader sits within 300 px of the top, chaining so a sparse scope still fills; the rail pages only on the reader's own scroll (wheel or keys), within 400 px of either end. A page keeps the view where it was. Sequence and arrival numbers count the loaded run, so they renumber as older pages arrive.

## Install and the login service

`golla setup` (`bunx gollabara setup` from npm, `bun src/cli.ts setup` from a built checkout) is idempotent:

- **Stable path.** It copies `package.json`, `dist/golla.js`, `web/dist`, `plugin/` and `.claude-plugin/` to `$GOLLABARA_HOME/app/<version>` and points the `app/current` symlink at it with one rename, so a `git pull` or a bunx cache eviction never breaks the running service. Older versions are removed after the switch. `app/install.json` records the version, the source (`npm`, or `checkout` with its path), label, port, data dir and whether the service is on; `update`, `doctor` and `uninstall` read it, after flags and env.
- **Bundle.** `dist/golla.js` is the whole CLI bundled with `bun build --target=bun`, so the npm package and the installed copy need no `node_modules`; it runs with `bun --no-install`. The server finds `web/dist` by walking up to gollabara's `package.json` (`src/shared/package-root.ts`), from `src/server` and from `dist/` alike.
- **Service (macOS).** A LaunchAgent, `~/Library/LaunchAgents/<label>.plist`, runs `<absolute bun> --no-install <app/current>/dist/golla.js serve` with `RunAtLoad` and `KeepAlive`, `GOLLABARA_PORT`, `GOLLABARA_DATA` and setup's `PATH` (launchd's own PATH has no `claude` or `codex` for triage), logging to `<data>/server.log`. Setup boots it out and bootstraps it again (`launchctl bootout`/`bootstrap gui/<uid>`), then waits up to 20 s for `GET /api/health`. When another server already answers on the port and the service is not loaded, setup writes the plist without loading it and fails, since that server would answer the health wait while the service crash-loops. `--no-service` skips it; other platforms skip it with a note.
- **Harnesses.** `src/setup/harness.ts` lists them; each has `detect`, `install`, `uninstall` and `status`. Claude Code is detected by `claude` on PATH. Setup runs `claude plugin marketplace add <app/current>` (which repoints an existing `gollabara` marketplace, such as a checkout) and `claude plugin install gollabara@gollabara`. Claude Code reads a directory marketplace's plugin in place, so switching `app/current` updates the plugin at the next session start. Codex CLI is detected by `codex` on PATH; see [Installing into Codex](#installing-into-codex).
- **Port.** `--port` sets the service's port. Hooks still post to 4747 unless `GOLLABARA_PORT` or `GOLLABARA_URL` is set where the harness runs, and setup says so.
- **Update.** `golla update` rebuilds the recorded checkout (`bun run build`) and runs its `setup`, or runs `bun x gollabara@latest setup`, with the recorded port and service choice. That setup reinstalls the plugins and restarts the service.
- **Uninstall.** `golla uninstall` boots out the service and removes its plist, uninstalls the plugin and removes the `gollabara` marketplace, removes `app/`, and removes the data dir unless `--keep-data` (never `/` or the home dir).
- **Doctor.** After the server and hook rows, `golla doctor` adds the installed version and source, the service (loaded, running, pid), each harness's plugin, sleep settings from `pmset -g custom` (advice when the Mac sleeps on power, which stops remote viewing) and Tailscale (installed, running, serve configured). It exits 1 when the server is unreachable, a hook is outdated, the service is installed but not running, or a detected harness has no plugin. Sleep and Tailscale are advice only.

To try any of this without touching a real install, set `GOLLABARA_HOME`, `GOLLABARA_DATA`, `GOLLABARA_SERVICE_LABEL`, `GOLLABARA_CLAUDE` and `GOLLABARA_CODEX` (stubs that record their arguments, or a missing path) to scratch values, and pass a free `--port`. For a real Codex, a scratch `CODEX_HOME` keeps it out of `~/.codex`.

## Capture (Claude Code)

| hook                                | What lands in the stream                                                               | Feedback delivered to the session                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `SessionStart`                      | Stored as a session record (`GET /api/sessions`), not a message, with the `claude` pid | —                                                                          |
| `PostToolUse` (all tools)           | Images in tool results, including MCP results (e.g. Open Design), with their `source`  | `additionalContext` next to the tool result                                |
| `Stop`                              | First line of the turn's last reply, in full (recap), only for turns a human started   | `additionalContext`, which continues the turn                              |
| `Stop` (`hook.js wait`, background) | Nothing                                                                                | Exit 2 with the feedback on stderr, which starts a turn in an idle session |
| `PreToolUse` (`AskUserQuestion`)    | The session's own question and options                                                 | —                                                                          |
| `UserPromptSubmit`                  | Nothing                                                                                | `additionalContext` alongside the user's prompt                            |
| `SessionEnd`                        | Nothing in the stream: the session is marked ended (`session-end`)                     | —                                                                          |

An image's `source` is the file the tool names (`file_path`, `path`, or `filename` in the tool input), set only when the result holds exactly one image. The server stores it with a dHash in the message body. The stream hides earlier captures of the same screen behind the newest: identical bytes, or the same `source` and size within `DHASH_MAX_DISTANCE` bits of the newest capture.

Every image also carries a `role`, decided in the hook without a model: `artifact` (something the session made) or `reference` (something it only looked at: a mock, an existing asset, an older screenshot). An image a built-in tool read from a file it names by absolute path (`file_path`, `path`, or `filename`, e.g. `Read`) is an artifact when the file's mtime is after the current turn started, and a reference otherwise; every page of a multi-page read shares the file's role. An image a tool produced directly is an artifact: any MCP result (`mcp__*`, screenshot tools included, even when the input names a file), and any image without an absolute file path. The turn start is the timestamp of the transcript's turn opener (the same last main-thread `user` entry with a `turnOrigin` that Stop looks for, through the same widening tail); without one, the first timestamp at the transcript's head (the session start); without either, or when the file can't be stat'd, the image is an artifact. The hook stats files and reads the transcript only for image results, and any error makes the image an artifact. The server stores `role` in the message body as sent; rows without one are artifacts.

References never take a sequence number, an arrival (「새 산출물 n →」), a pin, or a place in an artifact's stack of re-captures; they stack only among themselves. They are posted but folded by default: 「참고 이미지 n」 between the stream cells they arrived between, a row inside the chat message (or in its place, when the turn shows nothing else), and the viewer pages a reference among references only. Opening a fold shows them muted.

Feedback is queued with `POST /api/feedback`, which accepts only loopback and tailnet sources. On `PostToolUse`, `Stop` and `UserPromptSubmit`, the hook claims the session's pending feedback with one `POST /api/feedback/claim` in parallel with its event, inside the same 1.5 s budget. The claim marks the items delivered atomically, so a Stop that continued the turn for feedback lets the re-entered Stop (`stop_hook_active`) end the turn. The hook prints one JSON object on stdout only when it claimed something, and nothing otherwise. Feedback about an image carries the stored file's absolute path, so the session can open it.

`POST /api/feedback/discard` (`{ sessionId, ids? }`, loopback and tailnet only like the other feedback routes) removes items still queued for a session: the given ids, or all of them. Delivered items are never removed, and image files only those items quoted go too. The removal goes out as a `deleted` frame with `feedbackIds`. The queue tray offers it, as 「지우기」, only for a session that ended.

To tell who started a turn, Stop reads the tail of `transcript_path` and takes the last main-thread `user` entry with a `turnOrigin`. Only the entry that opens a turn has one. The tail starts at 256 KB and widens to 1, 4, then 8 MB until it holds an opener, because turns that Read screenshots can put megabytes after it. `human` and `sdk` count as the user. `task_notification` (Monitor events and background tasks), `peer`, `system` and `scheduled` post no recap, unless gollabara feedback was delivered after the opener (a `hook_additional_context` attachment starting with `[gollabara] Feedback from the user`): the user waits on that reply. Feedback claiming is the same either way. When the transcript can't be read, the opener isn't in the tail, or `turnOrigin` has another value, the recap is posted as before. A continuation Stop (`stop_hook_active`) always posts its recap.

### Wake-up delivery

An idle session (its turn ended, waiting for input) runs no hook, so hook delivery alone waits for the user to type in its terminal. A second Stop hook, `bun hook.js wait`, is declared with [`asyncRewake: true`](https://code.claude.com/docs/en/hooks#run-hooks-in-the-background): Claude Code runs it in the background, and when it exits 2 it starts a turn and shows Claude the hook's stderr as a system reminder. Plain interactive sessions need no flag.

- **Waiting.** The hook long-polls `GET /api/channel/wait?session=<session_id>&pid=<its ppid>&waiter=<its start time>` (loopback and tailnet only) in 25 s rounds, and claims with the same atomic claim (`deliveredVia: 'rewake'`) only while the session is idle (see **Idle only**). On a claim it writes the shared feedback text (`src/shared/feedback.ts`) to stderr and exits 2.
- **Linking.** Claude Code runs every hook as its direct child, so each sees the `claude` pid as its parent. SessionStart reports `process.ppid` and its `source` (as `reason`) with the session record; the latest SessionStart owns a pid, so `/clear` and resume move the link to the new session.
- **Stepping aside.** The endpoint answers 410 and the hook exits 0 when a newer Stop's waiter enlists (the newest start time wins, so there is one waiter per session), when a turn starts after it enlisted (the user typed; the other hooks deliver again), or when its pid was relinked to another session by `/clear` or resume. Claude Code kills none of these itself: a waiter armed before `/clear` would otherwise wake the new conversation. Busy alone does not retire it, because it starts as its Stop ends the turn, often before the server hears that Stop.
- **Timeout.** The hook's `timeout` is 86400 s (24 h; a 900 s wait was measured past the 600 s default). Claude Code kills it with SIGTERM at the timeout and tells the session nothing, so the waiter leaves 10 minutes early (`WAIT_BUDGET_MS`); the session stays reachable through the next turn's Stop. It also exits 0 when the server stays down for about 30 s (three retries 10 s apart, which ride out a dev restart), when its parent changes, or when `GOLLABARA_HOOK=off`.
- **Idle only.** The endpoint claims only while the session is idle (`activityAfter` in `src/server/channel.ts`); mid-turn, the other hooks hand feedback over at the next tool call or Stop. A prompt, tool call, question or wake-up marks the session busy. A Stop that claimed nothing marks it idle, and a Stop that claimed feedback continues the turn, so it stays busy. SessionStart (`startup`, `resume` or `clear`), or a session not seen yet, counts as idle. A `compact` SessionStart changes nothing: compaction can fire mid-turn, and the turn goes on, so it neither marks the session idle nor retires a waiter. A poll keeps waiting while the session is busy, and turning idle wakes it.
- **Mid-turn.** An exit 2 that lands while the session is busy is queued by Claude Code and opens its own turn after the current one; it never interrupts. Typing while the waiter waits causes no double delivery: whichever path claims first delivers, and the other finds nothing.
- **Not covered.** `claude -p` kills background hooks at teardown, so headless runs, including Open Design runs, keep hook delivery only.
- **Liveness.** A session with an open wake-up poll, or one that ended within 30 s, has `channel: true` in `GET /api/sessions` and the WebSocket session frames (the field keeps the name of the channel route it replaced), and `idle-wake` among its `routes` (see **Delivery routes**). The queue tray and the composer then say 「바로 전달돼요」 instead of 「세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요」. Rows delivered before that route was removed keep `deliveredVia: 'channel'`.
- **Recap.** A wake-up turn opens with `turnOrigin: "task_notification"` and `origin.kind: "task-notification"`, and its content is `Stop hook blocking error from command "Stop": ` followed by the stderr. When that carries `[gollabara] Feedback from the user`, the turn is the user's (`rewake`). Its Stop arrives with `stop_hook_active: true`, yet the recap opens a new turn instead of joining the previous one; feedback delivered at that Stop continues it as usual. Another hook's wake-up stays a wake-up.

### Ended sessions

A session ends with a `session-end` event (the `SessionEnd` hook, from Claude Code and Codex alike), or when its process goes away without one: a crash, a closed terminal, a killed process.

- **Process gone.** Every `SWEEP_MS` (20 s, and once at start) the server checks each running session that has a pid (`src/server/liveness.ts`): `process.kill(pid, 0)` failing (no such process, or another user's) means it is gone. Because a pid can be reused, after a reboot for instance, one `ps -o pid=,etime=` call also reads when each live pid's process started; a process that started more than 2 s after the SessionStart that linked it (`sessions.pid_at`) is not the session's. Links stored before #76 have no `pid_at` and get only the first check. A session ended this way is marked within one sweep.
- **Relinking.** The latest SessionStart owns a pid. When it takes the pid from another session (`/clear`, a resume in the same process, or a reused pid), that session is marked ended too, even if its own SessionEnd never came.
- **No pid.** A session that never reported a pid (older hooks) ends only through SessionEnd.
- **Coming back.** Any later event from an ended session (a resume, or any other event) clears `ended_at`. Feedback claims and wake-up polls do not.
- **Effects.** `endedAt` appears in `GET /api/sessions` and the session frames, with `routes: []` and no `channel`. `POST /api/feedback` to an ended session answers 409 `session ended`, and the UI says 「끝난 세션이에요」. A wake-up waiter for it gets 410 `ended` and exits. Feedback queued before the end stays queued: the tray marks it 「끝나서 전달할 수 없어요」, and a resumed session still picks it up. A session-end also closes the session's open turn and drops its pid.

### Delivery routes

Every session in `GET /api/sessions` and the WebSocket session frames carries `routes`, the harness-neutral ways feedback can reach it now (`DeliveryRoute` in `src/shared/types.ts`, derived by `routesFor` in `src/shared/routes.ts`): `next-tool` (next to the next tool result), `next-prompt` (alongside the next prompt), `turn-end` (when it tries to end its turn) and `idle-wake` (waking an idle session). Claude Code and Open Design sessions have all four while their wake-up waiter is live, and the first three otherwise; Codex sessions have the first three. The UI builds its copy from the routes alone (`routeNote` in `web/src/feedback.ts`): 「바로 전달돼요」 with `idle-wake`, 「세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요」 with `turn-end`. The composer states the target's route; the queue tray states the waiting sessions' shared route, or 「세션마다 전달 시점이 달라요」 with a route per group when they differ.

Session names are `<dir>` or `<dir> · <branch>` (the branch is omitted for main and master).

### Version handshake and hook health

- **Handshake.** Every hook request carries `X-Gollabara-Hook: <version>`, the version in `plugin/.claude-plugin/plugin.json` baked into `plugin/bin/hook.js` at build time, and `X-Gollabara-Harness`. The wake-up hook sends only the version; the server takes the harness from the session. Events from hooks older than the handshake carry neither header and are stored as before.
- **Recording.** On events, claims and wake-up polls the server upserts the harness's latest hook (version, or NULL for no header, and when) into `hook_versions`. `GET /api/health` returns `{ version, schema, hooks: [{ harness, version, seenAt, outdated }] }`, where `version` is the plugin version the server expects (the same `plugin.json`). A hook is `outdated` when it sent no version or an older one.
- **Health log.** Each hook run that sent a request appends one line to `hook-health.jsonl`: `at`, `event` (the hook event name), `harness`, `ms` (from the hook's start until its requests settled), `ok`, and on failure an `error` class (`timeout`, `unreachable`, `http-<status>`, `error`). No payload text. The append is synchronous (a few hundred bytes) and comes after the session's output; every error is swallowed. At 128 KB the file rotates to `hook-health.1.jsonl`, so the log stays under 256 KB. The wake-up hook does not log.
- **Doctor.** `golla doctor` prints whether the server answers `GET /api/health`, each harness's last hook version ("plugin outdated" for missing or older), p50/p95 latency and the latest failures from the health log, and the data directory.

Open Design runs the same plugin. When the hook's env has `OD_PROJECT_ID`, the session is tagged `open-design` and named after that project id. The hook reads no other `OD_*` value, because the env also holds a tool token.

## Capture (Codex CLI)

Codex runs the same `plugin/bin/hook.js` as `hook.js codex`. The argument is the only way the hook knows its harness: Codex hooks inherit codex's env verbatim (`CLAUDECODE` included when codex was started from Claude Code), so the hook never guesses from env and reads no `OD_*` value for Codex. The capture rules come from the spike ([docs/spikes/codex-hooks.md](docs/spikes/codex-hooks.md)); the payloads it recorded are in `src/hook/fixtures/codex/`.

| hook                                | What lands in the stream                                                                                                                                                          | Feedback delivered to the session                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `SessionStart`                      | A `codex` session record, its `source` (`startup`, `resume`) as `reason`, with the codex pid                                                                                      | —                                                                                |
| `PostToolUse` (all tools)           | MCP image results, and `view_image` (an `input_image` data URL; the type is sniffed from the bytes when Codex says `application/octet-stream`) with `tool_input.path` as `source` | `additionalContext` next to the tool result                                      |
| `Stop`                              | First line of `last_assistant_message` (recap), for every Stop                                                                                                                    | `decision: "block"` with the feedback as `reason`, which continues the same turn |
| `PreToolUse` (`request_user_input`) | The session's own question and options (no `multiSelect`; Codex asks only in Plan mode)                                                                                           | —                                                                                |
| `UserPromptSubmit`                  | Nothing                                                                                                                                                                           | `additionalContext` alongside the user's prompt                                  |
| `SessionEnd`                        | Nothing in the stream: the session is marked ended (`session-end`), as for Claude Code                                                                                            | —                                                                                |

- **Recaps for every Stop.** Codex records no `turnOrigin`, and its hooks see no wake-ups of the kind Claude Code has (Monitor ticks, task notifications): each turn opens with a prompt from the user or `codex exec`. A Stop with `stop_hook_active` (after gollabara's block) posts its recap as a continuation of the turn.
- **Loop guard.** Codex has no cap on Stop blocks, so a Stop with `stop_hook_active` never claims feedback: claiming marks items delivered, and that Stop must not block again. Queued items wait for the next tool call or prompt. Stop prints JSON or nothing (plain stdout, or `additionalContext`, fails a Codex Stop hook).
- **Image roles.** The #41 rule holds: a `view_image` of an absolute path is an artifact when the file changed after the turn started, a reference otherwise; MCP images are artifacts. The turn start is the last `event_msg` with `payload.type: "task_started"` in the rollout (`transcript_path`), through the same widening tail; a Stop block continues the same turn and opens none.
- **No idle wake.** Codex hooks can't wake an idle session (`async` hooks can't block), so a Codex session's routes are `next-tool`, `next-prompt` and `turn-end`. The app-server `turn/start` path is #82.
- **Never blocks.** The checklist runs as `bun test` (`src/hook/never-block.test.ts`) against the shipped bundle and the recorded payloads: exit 0 and only valid output on every payload, nothing printed and no wait past the budget when the server is down or failing, the 1.5 s request budget against a server that never answers, the 2.5 s hard deadline against a stalled stdin, the loop guard, and p95 latency under 300 ms over 40 runs.

### Installing into Codex

When `codex` is on PATH, `golla setup` (the `codex` harness in `src/setup/codex.ts`) writes a local marketplace to `$GOLLABARA_HOME/codex` from the installed app (`app/current/plugin`) and installs it with `codex plugin marketplace add <dir>` and `codex plugin add gollabara@gollabara`. Codex copies the plugin into its own cache, so it never follows `app/current`; each setup, and so each `update`, rewrites the stage and adds the plugin again, which refreshes the cached copy in place. `uninstall` runs `codex plugin remove`, `codex plugin marketplace remove gollabara` and removes the stage; `doctor` reads `codex plugin list --json`. The codex commands honor `CODEX_HOME`, and setup never edits Codex's config itself.

- **Layout.** Codex reads Claude-style plugins (`.claude-plugin/plugin.json` and `marketplace.json`), but it would load Claude Code's `hooks/hooks.json` from `plugin/`. So the installer stages its own copy: the shared `plugin/.claude-plugin/plugin.json` (one version for both harnesses), `plugin/bin/hook.js`, and a `hooks/hooks.json` rendered from `codexHooks()`. Nothing Codex-loadable is committed.
- **Absolute bun.** Hooks run with codex's env and no login shell, so `bun` is on PATH only by luck. Every command is `"<bun>" "${PLUGIN_ROOT}/bin/hook.js" codex`, with the bun setup runs on, spelled as on PATH when that is the same binary (a stable symlink, not a versioned Cellar path; `hookBun`).
- **Trust.** Codex trusts each handler by the hash of its definition (the command before `${PLUGIN_ROOT}` expands, and the timeout) and by its position, and `exec` and app-server skip untrusted hooks silently. So the commands, their order (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SessionEnd) and their timeouts are pinned by a test. Setup tells the user to open `codex` once and approve "Hooks need review"; editing the script (a version bump) keeps trust.
- **Timeouts.** 5 s on every event and 3 s on SessionEnd (Codex clamps it there). They are Codex's backstop only; the hook ends itself first.

## Notifications (opt-in)

「알림 받기」 in the settings sheet subscribes this device to Web Push (`src/server/push.ts`, `web/src/push.ts`). It is off until the user turns it on, per device: the browser's own subscription is the state. Permission is asked only on that click.

- **Keys.** The VAPID key pair is created once in `GOLLABARA_DATA/vapid.json` (mode 0600). `GET /api/push/key` returns the public key; `POST` and `DELETE /api/push/subscribe` (loopback and tailnet only, JSON) add or remove a device. Subscriptions live in the `push_subscriptions` table.
- **Payload.** Only `{"t":"q"}` (a question) or `{"t":"r"}` (an answer to feedback), encrypted with RFC 8291 aes128gcm and signed with VAPID (RFC 8292). The service worker (`web/sw.js`) shows fixed copy, 「세션이 기다리고 있어요」 or 「피드백에 답이 왔어요」, under one tag so pings replace each other. A click focuses or opens the app.
- **Triggers.** Every question, and the first recap after feedback was delivered to that session. Feedback claimed at Stop continues the turn, so its answer is the continuation recap, not that Stop's own recap, which may arrive after the claim. Deliveries from before the server started don't count. Muted sessions still ping, because mute lives in each browser (#79).
- **Never blocking.** Pushes go out in the background with a 10 s timeout. A 404 or 410 from the push service drops the subscription; other failures lose only that ping.
- **iOS.** Push reaches only the app added to the home screen; in Safari the setting says so.

## Triage (opt-in)

With 「대화 정리」 set to Claude or Codex (`PUT /api/settings`, loopback/tailnet only; stored in SQLite), the server judges each new recap line in the background (`src/server/triage.ts`): whether it is shown (`show` or `hide`), and for a shown line its `tone` (`default`, `success`, `warning` or `danger`). Images are never judged. Questions are always shown, so they are never judged; they appear only as context. Nothing that came in before the engine was turned on is judged.

- Each prompt carries the session's last 5 recap and question lines as context. The first 3 lines that arrive after feedback was delivered to the session also carry the text of that latest feedback, and the model is told to show a line that answers it. Those lines skip the cache.
- Calls run through `src/server/engine.ts` with a 30 s timeout, at most two at a time, never blocking `POST /api/events`. A failed call stores nothing, so the line stays shown.
- Each call runs with `GOLLABARA_HOOK=off`, no tools, and no user settings or MCP servers where the CLI allows it, so the call never becomes a session of its own.
- Hide verdicts are cached by normalized text (numbers ignored), so repeated ticks skip the model.
- The schema requires `tone` with `verdict` (codex strict mode), but only a shown line keeps it. A missing or unknown tone on a shown line reads as `default`, so it never costs the verdict. Lines that answer feedback get a tone like any other.
- The tone is stored in the `triage` table's nullable `tone` column, which migration 1 adds when missing. A NULL tone (hidden lines, verdicts from before tones) reads as `default`.
- The UI folds only recap-only lines judged `hide`, into in-place 「숨긴 메시지 n」 rows; consecutive hidden messages merge into one row, across sessions. Turns with images and questions are always shown; a hide there reads as `default`.
- A line already on screen is never removed by a later `hide`: it dims in place (muted, 11px). The chat tracks which lines it has drawn; after a reload the line folds like any other.
- Only a session's latest non-default line is drawn as a filled box; earlier stated lines keep only their icon. A `default` line does not clear an earlier state.
- Verdicts stored before #37 read as `signal` → `show` and `progress` / `noise` → `hide`. Old advice and draft columns are ignored.

## Conventions

- **UI:** Follow [DESIGN.md](DESIGN.md). Define tokens in `web/src/style.css` for dark (the default) and light. The design source is the Open Design project `gollabara-app` ("Night Dock"): its `app-night-dock.html` is authoritative for screens and interactions. Component structure is provisional; an atomic component system comes later.
- **Service worker:** `web/sw.js` is a template; the production build fills in the app shell and emits `/sw.js`, which only `golla serve` serves (`no-cache`) and only production builds register. It keeps the shell (page, entry chunks, icons) and caches other `/assets/*` on first use. It never caches `/api/*`, `/ws` or `/img/*`: stream data reaches the page only over the server.
- **Service name:** Always the Latin `gollabara`, never a Korean spelling.
- **Docs:** [README.md](README.md) (English) and [README.ko.md](README.ko.md) (Korean) must stay in sync. AGENTS.md, DESIGN.md, and [REVIEW.md](REVIEW.md) are in English. The README carries the design philosophy, not technical detail.
- **Language:** Code, comments, commit messages, PR titles and bodies, issues, and docs are in English. The exceptions are [README.ko.md](README.ko.md) and the product UI copy, which are Korean. Write in English even when the conversation with the user is in Korean.
- **Code comments:** Short, explaining why.
- **Releases:** Whenever hook code changes (anything that changes `plugin/bin/hook.js`), bump the version in `plugin/.claude-plugin/plugin.json` and `package.json` together, in the same PR. The version handshake compares the hook's baked-in version with the server's, so this is what lets `golla doctor` flag an outdated plugin. Publishing to npm (`prepublishOnly` runs `bun run build`) is the owner's call.
- **Commits:** Conventional Commits (`feat(web): …`, `fix(hook): …`), enforced by commitlint.
- **Pull requests:** `main` takes changes only through PRs and squash merges, so the PR title becomes the commit on `main` and must be a Conventional Commit too (checked by `pr-title`). Name branches `<type>/<short-topic>` (e.g. `ci/lint-and-hooks`). The `ci` and `pr-title` checks must pass and every review thread must be resolved before merging.
