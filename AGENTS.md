# AGENTS.md

A guide for agents (and people) working in this repository: product invariants, code layout, commands, and conventions. Read [README.md](README.md) for why the product looks the way it does and [DESIGN.md](DESIGN.md) for the visual rules.

## Invariants

1. **Observer, not mediator.** Never add features that ask a session for approval or invent questions. Mirror only the session's own questions (`AskUserQuestion`). No dedicated `post` / `ask` tools for agents to decide what to send.
2. **The hook never blocks a session.** 1.5 s timeout, swallow every error, always exit 0. If the server is down, exit quietly.
3. **Only artifacts flow.** Never mirror full transcripts. The units are images, one-line recaps, and questions.
4. **No rendering, no judging.** The server and the UI show received images as-is. No running HTML artifacts, server-side screenshots, or diffing.
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

| hook                             | What lands in the stream                                         |
| -------------------------------- | ---------------------------------------------------------------- |
| `SessionStart`                   | Sent, but the server ignores it for now                          |
| `PostToolUse` (all tools)        | Images in tool results, including MCP results (e.g. Open Design) |
| `Stop`                           | First line of the turn's last reply (recap, ≤160 chars)          |
| `PreToolUse` (`AskUserQuestion`) | The session's own question and options                           |

Session names are `<dir>` or `<dir> · <branch>` (the branch is omitted for main and master).

## Conventions

- **UI:** Follow [DESIGN.md](DESIGN.md). Define tokens in `web/src/style.css` for both light and dark. The design source is the Open Design project `gollabara-brand` (direction 03, "구경 모드 · Quiet signal"). The app mockup in the `gollabara-app` project is still under review and not adopted; do not port it.
- **Service name:** Always the Latin `gollabara`, never a Korean spelling.
- **Docs:** [README.md](README.md) (English) and [README.ko.md](README.ko.md) (Korean) must stay in sync. AGENTS.md, DESIGN.md, and [REVIEW.md](REVIEW.md) are in English. The README carries the design philosophy, not technical detail.
- **Code comments:** Short, in Korean, explaining why.
- **Commits:** Conventional Commits with Korean descriptions (`feat(web): …`, `fix(hook): …`), enforced by commitlint.
- **Pull requests:** `main` takes changes only through PRs and squash merges, so the PR title becomes the commit on `main` and must be a Conventional Commit too (checked by `pr-title`). Name branches `<type>/<short-topic>` (e.g. `ci/lint-and-hooks`). The `ci` and `pr-title` checks must pass and every review thread must be resolved before merging.
