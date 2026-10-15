# AGENTS.md

A guide for agents (and people) working in this repository: product invariants, code layout, commands, and conventions. Read [README.md](README.md) for why the product looks the way it does and [DESIGN.md](DESIGN.md) for the visual rules, and [docs/ROADMAP.md](docs/ROADMAP.md) for what comes next.

## Invariants

1. **Observer, not mediator.** gollabara never originates messages or questions and never asks a session for approval. Mirror only the session's own questions (`AskUserQuestion`). The one thing it sends to a session is feedback the user writes, delivered as-is. Answering `AskUserQuestion` and pausing a session remain out of scope. No dedicated `post` / `ask` tools for agents to decide what to send: the plugin exposes no tools. Triage only decides which chat lines the user sees, and with which state; it never writes to a session, so only what the user sends reaches one.
2. **The hook never blocks a session.** 1.5 s timeout, swallow every error, always exit 0. If the server is down, exit quietly. The one long-running hook, the wake-up Stop hook (`hook.js wait`), runs in the background (`asyncRewake`), so the session never waits on it; it exits 2 only to wake an idle session with the user's feedback.
3. **Only artifacts flow.** Never mirror full transcripts. The units are images, one-line recaps, and questions.
4. **Never judge artifacts.** The server and the UI show received images as-is. No scoring, server-side screenshots, or diffing of images. A perceptual hash (dHash) is used only to group near-identical re-captures of one file (`src/shared/stacks.ts`); it is never shown and never used to judge an image. Triage of chat text (whether a recap line is shown, and its state) is allowed, opt-in, and off by default. Previewing HTML artifacts is a possible future capability, not a prohibition; it is out of the current scope.
5. **Local only.** Data lives in local SQLite and image files. No third-party storage, no public internet exposure. The one exception is opt-in: with triage on, recap and question text, and the text of the user's latest feedback to that session, go to the model behind the user's own `claude` or `codex` CLI. Images never do.
6. **Multi-harness by design.** Only the Claude Code plugin exists today, and Open Design runs go through it. Codex comes next; Antigravity, other harnesses and Claude Design follow after the MVP ([docs/ROADMAP.md](docs/ROADMAP.md)). Keep the event types in `src/shared/types.ts` free of Claude-Code-only concepts.

## Layout

| Path          | Role                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| `src/cli.ts`  | `golla` CLI entry point (`serve`, `hook`)                                                  |
| `src/hook/`   | Hook input → stream events. `map.ts` is pure; I/O lives in `index.ts`                      |
| `src/server/` | `golla serve`: SQLite, hash-named image storage, WebSocket fan-out                         |
| `src/shared/` | Types and config shared by the server, the hook, and the UI                                |
| `web/`        | Viewer UI (Vue 3 + Vite)                                                                   |
| `plugin/`     | Claude Code plugin. `bin/hook.js` is a build output, but it is committed                   |
| `docs/`       | Architecture SVGs (from the Open Design `gollabara-architecture` project) and `ROADMAP.md` |
| `spike/`      | Early hook-input capture experiments, reference only                                       |

## Commands

Use [bun](https://bun.sh) 1.3+ only; never npm, pnpm, or yarn.

```bash
bun install          # also installs the husky git hooks
bun run build        # bundle the hook + build the web UI
bun run dev          # server, restarts on file change
bun run dev:web      # web dev server (4748, proxies to 4747)
bun test             # every *.test.ts (hook, server, shared, web)
bun run typecheck
bun run lint         # ESLint (@antfu/eslint-config), also formats Markdown/JSON/YAML
bun run lint:fix
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
| `GOLLABARA_DATA`          | `~/.gollabara/data`     | Where messages and images are stored                                                      |
| `GOLLABARA_HOOK`          | unset                   | `off`: the hooks exit at once, posting and claiming nothing                               |
| `GOLLABARA_ALLOWED_HOSTS` | unset                   | Comma-separated extra host names the server answers to (e.g. a reverse proxy's name)      |

`golla serve` listens on `127.0.0.1` plus each Tailscale address found on the network interfaces at start (`100.64.0.0/10`, `fd7a:115c:a1e0::/48`), one listener per address sharing the handlers and the WebSocket fan-out (`src/server/listen.ts`). A tailnet address that appears later is picked up on the next restart. Requests from any other source get 403 for every path. `GOLLABARA_HOST` replaces the addresses, and because it is the user's explicit opt-in, it also lifts that check; the feedback, settings and wake-up endpoints still accept only loopback and tailnet sources.

### Request checks

The source address is not enough: any web page open in this machine's browser also comes from loopback. `src/server/origin.ts` adds three checks to every request, whatever `GOLLABARA_HOST` says:

- **Host.** The `Host` header must be loopback (`localhost`, `127.0.0.1`, `[::1]`), a bound address (every interface address when the bind is a wildcard), a `.ts.net` name, this machine's hostname (with and without `.local`, or its first label), or a name in `GOLLABARA_ALLOWED_HOSTS`, with any port. Otherwise 403; this stops DNS rebinding.
- **Origin.** Mutations and the `/ws` upgrade get 403 when an `Origin` header names any other host (a `.ts.net` origin must equal the request's host), or when `Sec-Fetch-Site` is `cross-site`. Requests without `Origin` (the hook, curl) pass.
- **JSON.** Mutations under `/api/` need `Content-Type: application/json` (charset allowed), otherwise 415, so a page cannot send a preflight-free `text/plain` POST.

The vite dev server's proxy (`localhost:4748`) passes as loopback, so it needs no `changeOrigin`.

## Storage

`GOLLABARA_DATA` holds `stream.db` (SQLite, WAL) and `images/`. The schema is versioned with `PRAGMA user_version`: `src/server/migrations.ts` lists numbered migrations, and opening the store applies each one past the stored version in order, every one in its own transaction together with its version bump. Change the schema only by appending a migration; never edit a shipped one, and never add `CREATE TABLE IF NOT EXISTS` or column checks to `store.ts`. Migration 1 is the schema from before versioning: it brings any version-0 database, with or without the columns once added on open (`sessions.pid`, `triage.tone`), to that schema in place without losing rows. A database newer than the code is left as is.

## Capture (Claude Code)

| hook                                | What lands in the stream                                                               | Feedback delivered to the session                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `SessionStart`                      | Stored as a session record (`GET /api/sessions`), not a message, with the `claude` pid | —                                                                          |
| `PostToolUse` (all tools)           | Images in tool results, including MCP results (e.g. Open Design), with their `source`  | `additionalContext` next to the tool result                                |
| `Stop`                              | First line of the turn's last reply, in full (recap), only for turns a human started   | `additionalContext`, which continues the turn                              |
| `Stop` (`hook.js wait`, background) | Nothing                                                                                | Exit 2 with the feedback on stderr, which starts a turn in an idle session |
| `PreToolUse` (`AskUserQuestion`)    | The session's own question and options                                                 | —                                                                          |
| `UserPromptSubmit`                  | Nothing                                                                                | `additionalContext` alongside the user's prompt                            |

An image's `source` is the file the tool names (`file_path`, `path`, or `filename` in the tool input), set only when the result holds exactly one image. The server stores it with a dHash in the message body. The stream hides earlier captures of the same screen behind the newest: identical bytes, or the same `source` and size within `DHASH_MAX_DISTANCE` bits of the newest capture.

Every image also carries a `role`, decided in the hook without a model: `artifact` (something the session made) or `reference` (something it only looked at: a mock, an existing asset, an older screenshot). An image a built-in tool read from a file it names by absolute path (`file_path`, `path`, or `filename`, e.g. `Read`) is an artifact when the file's mtime is after the current turn started, and a reference otherwise; every page of a multi-page read shares the file's role. An image a tool produced directly is an artifact: any MCP result (`mcp__*`, screenshot tools included, even when the input names a file), and any image without an absolute file path. The turn start is the timestamp of the transcript's turn opener (the same last main-thread `user` entry with a `turnOrigin` that Stop looks for, through the same widening tail); without one, the first timestamp at the transcript's head (the session start); without either, or when the file can't be stat'd, the image is an artifact. The hook stats files and reads the transcript only for image results, and any error makes the image an artifact. The server stores `role` in the message body as sent; rows without one are artifacts.

References never take a sequence number, an arrival (「새 산출물 n →」), a pin, or a place in an artifact's stack of re-captures; they stack only among themselves. They are posted but folded by default: 「참고 이미지 n」 between the stream cells they arrived between, a row inside the chat message (or in its place, when the turn shows nothing else), and the viewer pages a reference among references only. Opening a fold shows them muted.

Feedback is queued with `POST /api/feedback`, which accepts only loopback and tailnet sources. On `PostToolUse`, `Stop` and `UserPromptSubmit`, the hook claims the session's pending feedback with one `POST /api/feedback/claim` in parallel with its event, inside the same 1.5 s budget. The claim marks the items delivered atomically, so a Stop that continued the turn for feedback lets the re-entered Stop (`stop_hook_active`) end the turn. The hook prints one JSON object on stdout only when it claimed something, and nothing otherwise. Feedback about an image carries the stored file's absolute path, so the session can open it.

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
- **Liveness.** A session with an open wake-up poll, or one that ended within 30 s, has `channel: true` in `GET /api/sessions` and the WebSocket session frames (the field keeps the name of the channel route it replaced). The queue tray then says 「바로 전달돼요」 instead of 「세션이 다음 작업을 할 때 전달돼요」. Rows delivered before that route was removed keep `deliveredVia: 'channel'`.
- **Recap.** A wake-up turn opens with `turnOrigin: "task_notification"` and `origin.kind: "task-notification"`, and its content is `Stop hook blocking error from command "Stop": ` followed by the stderr. When that carries `[gollabara] Feedback from the user`, the turn is the user's (`rewake`). Its Stop arrives with `stop_hook_active: true`, yet the recap opens a new turn instead of joining the previous one; feedback delivered at that Stop continues it as usual. Another hook's wake-up stays a wake-up.

Session names are `<dir>` or `<dir> · <branch>` (the branch is omitted for main and master).

Open Design runs the same plugin. When the hook's env has `OD_PROJECT_ID`, the session is tagged `open-design` and named after that project id. The hook reads no other `OD_*` value, because the env also holds a tool token.

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
- **Service name:** Always the Latin `gollabara`, never a Korean spelling.
- **Docs:** [README.md](README.md) (English) and [README.ko.md](README.ko.md) (Korean) must stay in sync. AGENTS.md, DESIGN.md, and [REVIEW.md](REVIEW.md) are in English. The README carries the design philosophy, not technical detail.
- **Language:** Code, comments, commit messages, PR titles and bodies, issues, and docs are in English. The exceptions are [README.ko.md](README.ko.md) and the product UI copy, which are Korean. Write in English even when the conversation with the user is in Korean.
- **Code comments:** Short, explaining why.
- **Commits:** Conventional Commits (`feat(web): …`, `fix(hook): …`), enforced by commitlint.
- **Pull requests:** `main` takes changes only through PRs and squash merges, so the PR title becomes the commit on `main` and must be a Conventional Commit too (checked by `pr-title`). Name branches `<type>/<short-topic>` (e.g. `ci/lint-and-hooks`). The `ci` and `pr-title` checks must pass and every review thread must be resolved before merging.
