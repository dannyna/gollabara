---
enabled: true
trigger: on-open
---

# Code review guide

gollabara is a local web app that streams the artifacts of coding and design sessions: a Bun server, a Claude Code hook plugin, and a Vue 3 viewer. These are the project-specific rules to check first. The reasoning lives in [AGENTS.md](AGENTS.md) and [DESIGN.md](DESIGN.md).

## Must flag

- **Observer, not mediator.** Flag any feature that asks a session for approval, invents questions, or adds `post` / `ask` tools for agents. Only the session's own `AskUserQuestion` is mirrored.
- **The hook never blocks a session.** Hook code must keep the 1.5 s timeout, swallow every error, and always exit 0. Flag any new throw, retry loop, unbounded wait, or non-zero exit path.
- **Only artifacts flow.** Flag anything that mirrors full transcripts. The units are images, one-line recaps, and questions.
- **No rendering, no judging.** Flag running HTML artifacts, server-side screenshots, or image diffing.
- **Local only.** Flag third-party storage, telemetry, or binding that exposes the server to the public internet.
- **Multi-harness types.** Event types in `src/shared/types.ts` must not depend on Claude-Code-only concepts.
- **Rebuilt hook bundle.** A change to `src/hook/` or `src/shared/` must include a rebuilt `plugin/bin/hook.js` (`bun run build:hook`).
- **UI follows DESIGN.md.** For example: yellow only as a fill or outline, never as text on light screens; no `box-shadow`; question options are static labels, not buttons; numbers in IBM Plex Mono; new tokens defined for both light and dark in `web/src/style.css`.

## Tests

- Run `bun test` (every `*.test.ts` under `src/` and `web/src/`).
- `src/hook/map.ts` and the adapters (`src/hook/claude-code.ts`, `src/hook/codex.ts`) are pure, so any mapping change needs a fixture-based test.

## Skip / low priority

- `bun.lock`
- `plugin/bin/hook.js` (generated; check only that it was rebuilt)
- `web/dist/`
- `docs/*.svg` (exported from Open Design)
- `.impeccable/design.json` (generated from DESIGN.md)
- `spike/` (early experiments, reference only)

## Conventions

- Code, comments, commit messages, and PRs are in English (README.ko.md and the UI copy are Korean); commits follow Conventional Commits.
- Agent-facing docs (AGENTS.md, DESIGN.md, REVIEW.md) are in English; README.md and README.ko.md stay in sync.
- The service name is always the Latin `gollabara`.
