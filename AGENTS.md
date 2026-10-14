# AGENTS.md

A guide for agents (and people) working in this repository: product invariants, code layout, commands, and conventions. Read [README.md](README.md) for why the product looks the way it does and [DESIGN.md](DESIGN.md) for the visual rules.

## Invariants

1. **Observer, not mediator.** gollabara never originates messages or questions and never asks a session for approval. Mirror only the session's own questions (`AskUserQuestion`). The one thing it sends to a session is feedback the user writes, delivered as-is. Answering `AskUserQuestion` and pausing a session remain out of scope. No dedicated `post` / `ask` tools for agents to decide what to send.
2. **The hook never blocks a session.** 1.5 s timeout, swallow every error, always exit 0. If the server is down, exit quietly.
3. **Only artifacts flow.** Never mirror full transcripts. The units are images, one-line recaps, and questions.
4. **No judging, no diffing.** The server and the UI show received images as-is. No scoring, server-side screenshots, or diffing. Previewing HTML artifacts is a possible future capability, not a prohibition; it is out of the current scope.
5. **Local only.** Data lives in local SQLite and image files. No third-party storage, no public internet exposure.
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

| Variable         | Default                 | Description                          |
| ---------------- | ----------------------- | ------------------------------------ |
| `GOLLABARA_PORT` | `4747`                  | Server port                          |
| `GOLLABARA_URL`  | `http://127.0.0.1:4747` | Server the hook posts events to      |
| `GOLLABARA_DATA` | `~/.gollabara/data`     | Where messages and images are stored |

## Capture (Claude Code)

| hook                             | What lands in the stream                                         | Feedback delivered to the session                 |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| `SessionStart`                   | Stored as a session record (`GET /api/sessions`), not a message  | —                                                 |
| `PostToolUse` (all tools)        | Images in tool results, including MCP results (e.g. Open Design) | `additionalContext` next to the tool result       |
| `Stop`                           | First line of the turn's last reply (recap, ≤160 chars)          | `decision: "block"` with the feedback as `reason` |
| `PreToolUse` (`AskUserQuestion`) | The session's own question and options                           | —                                                 |
| `UserPromptSubmit`               | Nothing                                                          | `additionalContext` alongside the user's prompt   |

Feedback is queued with `POST /api/feedback`, which accepts only loopback and tailnet sources. On the three hooks above, the hook claims the session's pending feedback with one `POST /api/feedback/claim` in parallel with its event, inside the same 1.5 s budget. The claim marks the items delivered atomically, so a Stop that blocked for feedback lets the re-entered Stop (`stop_hook_active`) end the turn. The hook prints one JSON object on stdout only when it claimed something, and nothing otherwise. Feedback about an image carries the stored file's absolute path, so the session can open it.

Session names are `<dir>` or `<dir> · <branch>` (the branch is omitted for main and master).

Open Design runs the same plugin. When the hook's env has `OD_PROJECT_ID`, the session is tagged `open-design` and named after that project id. The hook reads no other `OD_*` value, because the env also holds a tool token.

## Conventions

- **UI:** Follow [DESIGN.md](DESIGN.md). Define tokens in `web/src/style.css` for dark (the default) and light. The design source is the Open Design project `gollabara-app` ("Night Dock"): its `app-night-dock.html` is authoritative for screens and interactions. Component structure is provisional; an atomic component system comes later.
- **Service name:** Always the Latin `gollabara`, never a Korean spelling.
- **Docs:** [README.md](README.md) (English) and [README.ko.md](README.ko.md) (Korean) must stay in sync. AGENTS.md, DESIGN.md, and [REVIEW.md](REVIEW.md) are in English. The README carries the design philosophy, not technical detail.
- **Language:** Code, comments, commit messages, PR titles and bodies, issues, and docs are in English. The exceptions are [README.ko.md](README.ko.md) and the product UI copy, which are Korean. Write in English even when the conversation with the user is in Korean.
- **Code comments:** Short, explaining why.
- **Commits:** Conventional Commits (`feat(web): …`, `fix(hook): …`), enforced by commitlint.
- **Pull requests:** `main` takes changes only through PRs and squash merges, so the PR title becomes the commit on `main` and must be a Conventional Commit too (checked by `pr-title`). Name branches `<type>/<short-topic>` (e.g. `ci/lint-and-hooks`). The `ci` and `pr-title` checks must pass and every review thread must be resolved before merging.
