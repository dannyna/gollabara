# AGENTS.md

A guide for agents (and people) working in this repository: product invariants, code layout, commands, and conventions. Read [README.md](README.md) for why the product looks the way it does and [DESIGN.md](DESIGN.md) for the visual rules.

## Invariants

1. **Observer, not mediator.** gollabara never originates messages or questions and never asks a session for approval. Mirror only the session's own questions (`AskUserQuestion`). The one thing it sends to a session is feedback the user writes, delivered as-is. Answering `AskUserQuestion` and pausing a session remain out of scope. No dedicated `post` / `ask` tools for agents to decide what to send. Triage advice and draft replies are shown only to the user: a draft fills the composer and is never sent automatically, so only what the user sends reaches a session.
2. **The hook never blocks a session.** 1.5 s timeout, swallow every error, always exit 0. If the server is down, exit quietly.
3. **Only artifacts flow.** Never mirror full transcripts. The units are images, one-line recaps, and questions.
4. **Never judge artifacts.** The server and the UI show received images as-is. No scoring, server-side screenshots, or diffing of images. Triage and advice on chat text (recaps and questions) are allowed, opt-in, and off by default. Previewing HTML artifacts is a possible future capability, not a prohibition; it is out of the current scope.
5. **Local only.** Data lives in local SQLite and image files. No third-party storage, no public internet exposure. The one exception is opt-in: with triage on, recap and question text goes to the model behind the user's own `claude` or `codex` CLI. Images never do.
6. **Multi-harness by design.** Only the Claude Code plugin exists today, but Codex, Open Design, and Claude Design are targets. Keep the event types in `src/shared/types.ts` free of Claude-Code-only concepts.

## Layout

| Path          | Role                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| `src/cli.ts`  | `golla` CLI entry point (`serve`, `hook`)                                 |
| `src/hook/`   | Hook input → stream events. `map.ts` is pure; I/O lives in `index.ts`     |
| `src/server/` | `golla serve`: SQLite, hash-named image storage, WebSocket fan-out        |
| `src/shared/` | Types and config shared by the server, the hook, and the UI               |
| `web/`        | Viewer UI (Vue 3 + Vite)                                                  |
| `plugin/`     | Claude Code plugin. `bin/hook.js` is a build output, but it is committed  |
| `docs/`       | Architecture SVGs (from the Open Design `gollabara-architecture` project) |
| `spike/`      | Early hook-input capture experiments, reference only                      |

## Commands

Use [bun](https://bun.sh) 1.3+ only; never npm, pnpm, or yarn.

```bash
bun install          # also installs the husky git hooks
bun run build        # bundle the hook + build the web UI
bun run dev          # server, restarts on file change
bun run dev:web      # web dev server (4748, proxies to 4747)
bun test             # hook mapping tests
bun run typecheck
bun run lint         # ESLint (@antfu/eslint-config), also formats Markdown/JSON/YAML
bun run lint:fix
```

`bun install` sets up husky git hooks: pre-commit runs lint-staged, and commit-msg runs commitlint.

After editing `src/hook/` or `src/shared/`, rebuild `plugin/bin/hook.js` with `bun run build:hook` and commit it. The plugin is copied into a cache and runs from this file alone.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → web build, then checks that the committed `plugin/bin/hook.js` matches the source.

## Configuration

| Variable         | Default                 | Description                                                 |
| ---------------- | ----------------------- | ----------------------------------------------------------- |
| `GOLLABARA_PORT` | `4747`                  | Server port                                                 |
| `GOLLABARA_URL`  | `http://127.0.0.1:4747` | Server the hook posts events to                             |
| `GOLLABARA_DATA` | `~/.gollabara/data`     | Where messages and images are stored                        |
| `GOLLABARA_HOOK` | unset                   | `off`: the hook exits at once, posting and claiming nothing |

## Capture (Claude Code)

| hook                             | What lands in the stream                                                                | Feedback delivered to the session               |
| -------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `SessionStart`                   | Stored as a session record (`GET /api/sessions`), not a message                         | —                                               |
| `PostToolUse` (all tools)        | Images in tool results, including MCP results (e.g. Open Design)                        | `additionalContext` next to the tool result     |
| `Stop`                           | First line of the turn's last reply (recap, ≤160 chars), only for turns a human started | `additionalContext`, which continues the turn   |
| `PreToolUse` (`AskUserQuestion`) | The session's own question and options                                                  | —                                               |
| `UserPromptSubmit`               | Nothing                                                                                 | `additionalContext` alongside the user's prompt |

Feedback is queued with `POST /api/feedback`, which accepts only loopback and tailnet sources. On the three hooks above, the hook claims the session's pending feedback with one `POST /api/feedback/claim` in parallel with its event, inside the same 1.5 s budget. The claim marks the items delivered atomically, so a Stop that continued the turn for feedback lets the re-entered Stop (`stop_hook_active`) end the turn. The hook prints one JSON object on stdout only when it claimed something, and nothing otherwise. Feedback about an image carries the stored file's absolute path, so the session can open it.

To tell who started a turn, Stop reads the tail of `transcript_path` and takes the last main-thread `user` entry with a `turnOrigin`. Only the entry that opens a turn has one. The tail starts at 256 KB and widens to 1, 4, then 8 MB until it holds an opener, because turns that Read screenshots can put megabytes after it. `human` and `sdk` count as the user. `task_notification` (Monitor events and background tasks), `peer`, `system` and `scheduled` post no recap, unless gollabara feedback was delivered after the opener (a `hook_additional_context` attachment starting with `[gollabara] Feedback from the user`): the user waits on that reply. Feedback claiming is the same either way. When the transcript can't be read, the opener isn't in the tail, or `turnOrigin` has another value, the recap is posted as before. A continuation Stop (`stop_hook_active`) always posts its recap.

Session names are `<dir>` or `<dir> · <branch>` (the branch is omitted for main and master).

Open Design runs the same plugin. When the hook's env has `OD_PROJECT_ID`, the session is tagged `open-design` and named after that project id. The hook reads no other `OD_*` value, because the env also holds a tool token.

## Triage (opt-in)

With 「대화 정리 · 조언」 set to Claude or Codex (`PUT /api/settings`, loopback/tailnet only; stored in SQLite), the server judges each new recap line and question in the background (`src/server/triage.ts`): `signal`, `progress` or `noise`. For signal lines and questions it also suggests one advice line and a draft reply. Nothing that came in before the engine was turned on is judged.

- Calls run through `src/server/engine.ts` with a 30 s timeout, at most two at a time, never blocking `POST /api/events`. A failed call stores nothing, so the line stays shown.
- Each call runs with `GOLLABARA_HOOK=off`, no tools, and no user settings or MCP servers where the CLI allows it, so the call never becomes a session of its own.
- Noise verdicts are cached by normalized text (numbers ignored), so repeated ticks skip the model.
- The UI hides only recap-only lines judged noise. Turns with images and questions are always shown.

## Conventions

- **UI:** Follow [DESIGN.md](DESIGN.md). Define tokens in `web/src/style.css` for dark (the default) and light. The design source is the Open Design project `gollabara-app` ("Night Dock"): its `app-night-dock.html` is authoritative for screens and interactions. Component structure is provisional; an atomic component system comes later.
- **Service name:** Always the Latin `gollabara`, never a Korean spelling.
- **Docs:** [README.md](README.md) (English) and [README.ko.md](README.ko.md) (Korean) must stay in sync. AGENTS.md, DESIGN.md, and [REVIEW.md](REVIEW.md) are in English. The README carries the design philosophy, not technical detail.
- **Language:** Code, comments, commit messages, PR titles and bodies, issues, and docs are in English. The exceptions are [README.ko.md](README.ko.md) and the product UI copy, which are Korean. Write in English even when the conversation with the user is in Korean.
- **Code comments:** Short, explaining why.
- **Commits:** Conventional Commits (`feat(web): …`, `fix(hook): …`), enforced by commitlint.
- **Pull requests:** `main` takes changes only through PRs and squash merges, so the PR title becomes the commit on `main` and must be a Conventional Commit too (checked by `pr-title`). Name branches `<type>/<short-topic>` (e.g. `ci/lint-and-hooks`). The `ci` and `pr-title` checks must pass and every review thread must be resolved before merging.
