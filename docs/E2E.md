# End-to-end scenarios

These scenarios check that the shipped features work together, on `main` as built, with real harnesses. Unit tests (`bun run test`) check each part alone; every PR was verified on its own branch, but nobody had run them together. Each scenario maps to a requirement: an MVP item in [ROADMAP.md](ROADMAP.md), an issue's "Done when", a row of a capture table in [AGENTS.md](../AGENTS.md), or a testable invariant.

**How** says how a scenario is run:

- **auto**: a script or an agent can run it and read the result (curl, `claude -p`, `codex exec`, Playwright).
- **tmux**: needs an interactive `claude` or `codex`, driven in its own tmux session.
- **manual**: needs a person. These are listed again in [Manual checklist](#manual-checklist).

The **Result** column is filled in by each run: `pass`, `fail (#issue)`, `partial` (with a note), or `—` (not run). The latest run is recorded in [Runs](#runs).

## Setup

Never run a scenario against the owner's server (port 4747), data (`~/.gollabara`) or config. Each run uses:

- A free port `P` and a fresh `GOLLABARA_DATA`, `GOLLABARA_HOME` and `GOLLABARA_SERVICE_LABEL` (e.g. `dev.gollabara.e2e-<n>`).
- `GOLLABARA_URL=http://127.0.0.1:P` exported in the env of every `claude` and `codex` the run starts, so no hook posts to another server.
- A scratch `CODEX_HOME` for Codex, and a scratch git repo as the session's working directory (on a branch other than `main`, so the session name shows it).
- `claude --plugin-dir <checkout>/plugin` for Claude Code, so the owner's installed plugin is not changed; or `GOLLABARA_CLAUDE` pointing at a stub for `golla setup`.
- A clean exit: stop only the processes the run started, by pid, and list what it left in `~/.claude*` and `~/.codex`.

## Install and doctor

Covers MVP 1, #65, #66, #67.

| ID  | Covers | Steps                                                                                                                                     | Expected                                                                                                                                                                                | How    | Result |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| S1  | #67    | `bun run build`, `bun pm pack`, then `bunx <tarball> setup --port P` with the scratch env and a stub `GOLLABARA_CLAUDE`                   | `app/current` points at the version; `install.json` is written; the LaunchAgent is loaded and `GET /api/health` answers within 20 s; `/` serves the web UI; `plugin/bin/hook.js` exists | auto   | —      |
| S2  | #67    | After S1, run `claude -p "say hi" --plugin-dir <app/current>/plugin`                                                                      | A session and its recap appear in the stream within 2 minutes of starting S1                                                                                                            | auto   | —      |
| S3  | #67    | `golla doctor` after S1 and S2                                                                                                            | Rows for server, plugin version, hook latency, install, service (running, pid), Claude Code plugin, sleep, Tailscale; exit 0 when nothing is wrong                                      | auto   | —      |
| S4  | #65    | `POST /api/events` without `X-Gollabara-Hook`, then `golla doctor`                                                                        | The event is stored; doctor says "plugin outdated" and exits 1                                                                                                                          | auto   | —      |
| S5  | #66    | Run a hook against a server that accepts the connection and never answers, then `golla doctor`; append past 128 KB to `hook-health.jsonl` | Doctor shows the failure as `timeout` with its latency; the log rotates to `hook-health.1.jsonl` and stays under 256 KB                                                                 | auto   | —      |
| S6  | #67    | Kill the service's server pid                                                                                                             | launchd starts it again (`KeepAlive`); `/api/health` answers again                                                                                                                      | auto   | —      |
| S7  | #67    | `golla update` on a checkout install                                                                                                      | The checkout is rebuilt, setup runs again, the service restarts on the new `app/<version>`                                                                                              | auto   | —      |
| S8  | #67    | `golla uninstall --keep-data`, then setup again, then `golla uninstall`                                                                   | The first keeps the data dir; the second leaves no plist, no `app/`, no data dir; the stub saw `plugin uninstall` and `marketplace remove`                                              | auto   | —      |
| S9  | #67    | Log out and in, or reboot                                                                                                                 | The service is running after login                                                                                                                                                      | manual | —      |

## Claude Code capture

Covers MVP 4, the Claude Code capture table.

| ID  | Covers            | Steps                                                                                  | Expected                                                                                          | How  | Result |
| --- | ----------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---- | ------ |
| C1  | SessionStart      | Start a session in the scratch repo on branch `feat/e2e`                               | A session record with the `claude` pid, named `<dir> · feat/e2e`                                  | auto | —      |
| C2  | Stop              | A human prompt that ends in a two-line reply                                           | One recap: the reply's first line, in full                                                        | auto | —      |
| C3  | Stop, turn origin | In an interactive session, let a background task or Monitor event open a turn          | No recap for that turn; a human turn after it posts one                                           | tmux | —      |
| C4  | PostToolUse, #41  | The session writes a PNG, then Reads it                                                | An image with `role: artifact` and `source` set to the file; a stream cell with a sequence number | auto | —      |
| C5  | PostToolUse, #41  | The session Reads a PNG that existed before the turn                                   | `role: reference`; folded as 「참고 이미지 1」 in the rail and the chat, with no sequence number  | auto | —      |
| C6  | stacks            | Read the same file twice with a small change between                                   | One cell; the earlier capture is stacked behind the newest                                        | auto | —      |
| C7  | PostToolUse, MCP  | A session gets an image from an MCP tool (e.g. a Playwright or Open Design screenshot) | An image with `role: artifact`                                                                    | auto | —      |
| C8  | PreToolUse        | An interactive session calls AskUserQuestion                                           | The question and its options appear in the chat                                                   | tmux | —      |
| C9  | Open Design       | `OD_PROJECT_ID=e2e-od claude -p …`                                                     | The session is tagged `open-design` and named `e2e-od`                                            | auto | —      |
| C10 | #97, invariant 2  | Time `claude -p "say hi"` with the plugin                                              | Exits in under 15 s; no `hook.js wait` process is left                                            | auto | —      |
| C11 | invariant 2       | Run `claude -p` with the server stopped, then with a server that never answers         | The run is unaffected and prints no hook error; each hook run ends within 2.5 s                   | auto | —      |
| C12 | #102              | Recaps, images and feedback in C2–C9 come from the 0.3.2 bundle                        | `GET /api/health` lists `claude-code` at 0.3.2, not outdated                                      | auto | —      |

## Feedback to Claude Code

Covers MVP 4, #71, the delivery rows of the capture table.

| ID  | Covers         | Steps                                                                                          | Expected                                                                                                     | How  | Result |
| --- | -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---- | ------ |
| F1  | next-tool      | Queue feedback while a turn is running tool calls                                              | Delivered next to the next tool result; the session acts on it; the item shows as delivered                  | auto | —      |
| F2  | turn-end       | Queue feedback during a short turn with no more tool calls                                     | Stop continues the turn; a continuation recap is posted; the turn then ends (no loop)                        | auto | —      |
| F3  | next-prompt    | Queue feedback to an idle headless session, then resume it with a prompt                       | Delivered alongside the prompt                                                                               | auto | —      |
| F4  | idle-wake      | Leave an interactive session idle, then queue feedback                                         | The tray says 「바로 전달돼요」; the session wakes within 5 s and replies; its recap is posted               | tmux | —      |
| F5  | exactly once   | Queue feedback, and type in the session at the same moment                                     | Delivered exactly once                                                                                       | tmux | —      |
| F6  | relink         | Arm the waiter, run `/clear`, then queue feedback to the old session and to the new one        | The old waiter steps aside; the old session is marked ended (E6); the new session gets only its own feedback | tmux | —      |
| F7  | image feedback | Send feedback about an image                                                                   | The delivered text carries the stored file's absolute path, and the session can open it                      | auto | —      |
| F8  | routes         | Compare the composer and tray copy for an interactive session (waiter live) and a headless one | 「바로 전달돼요」 with `idle-wake`; 「세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요」 without              | tmux | —      |

## Codex CLI

Covers MVP 4, #71, #72, the Codex capture table.

| ID  | Covers             | Steps                                                                        | Expected                                                                                          | How    | Result |
| --- | ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ | ------ |
| X1  | #72 install        | `golla setup` from a checkout with a real `codex` and a scratch `CODEX_HOME` | `codex plugin list --json` shows gollabara; doctor says `codex plugin 0.3.2 enabled`              | auto   | —      |
| X2  | #72 trust          | Open `codex` once after X1                                                   | "Hooks need review" appears; after approving, hooks run without `--dangerously-bypass-hook-trust` | manual | —      |
| X3  | SessionStart, Stop | `codex exec` a short task                                                    | A `codex` session with its pid; one recap per Stop                                                | auto   | —      |
| X4  | PostToolUse        | `view_image` of a file written in the turn, then of an older file            | The first is an artifact with `source`; the second is a reference                                 | auto   | —      |
| X5  | next-tool          | Queue feedback while a Codex turn runs tools                                 | Delivered as `additionalContext` next to the tool result                                          | auto   | —      |
| X6  | turn-end, loop     | Queue feedback before a Codex turn ends                                      | Stop blocks once with the feedback; the continuation Stop claims nothing and ends the turn        | auto   | —      |
| X7  | #71 routes         | Look at the composer and tray for a Codex session                            | Three routes; 「세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요」                                 | auto   | —      |
| X8  | SessionEnd         | Let `codex exec` finish                                                      | The session is marked ended                                                                       | auto   | —      |
| X9  | PreToolUse         | In Plan mode, get Codex to call `request_user_input`                         | The question and its options appear in the chat                                                   | manual | —      |
| X10 | #72 side by side   | Run a Claude Code and a Codex session against one server                     | Both appear in the stream and chat with their own names, recaps and routes                        | auto   | —      |

## Ended sessions

Covers #76 and #98.

| ID  | Covers | Steps                                                          | Expected                                                                                             | How  | Result |
| --- | ------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | ------ |
| E1  | #76    | End a session normally (`claude -p` exit)                      | `endedAt` is set by SessionEnd; the UI shows 「끝남」 and fades the name and text, not the images    | auto | —      |
| E2  | #76    | `kill -9` a running session                                    | Marked ended within 60 s                                                                             | auto | —      |
| E3  | #76    | Send feedback to an ended session                              | 409 `session ended`; the composer says 「끝난 세션이에요」 and does not send                         | auto | —      |
| E4  | #98    | Queue feedback, then end the session                           | The tray shows 「끝나서 전달할 수 없어요」 with 「지우기」; 「지우기」 removes it in every open view | auto | —      |
| E5  | #76    | Resume an ended session that has queued feedback (`claude -r`) | `endedAt` clears; the queued feedback is delivered                                                   | auto | —      |
| E6  | #76    | `/clear` in an interactive session                             | The old session is marked ended; the new one takes the pid                                           | tmux | —      |
| E7  | #98    | Two sessions in directories with the same name queue feedback  | The tray shows two groups                                                                            | auto | —      |

## Stream, chat and first run

Covers MVP 5, #75, #78, invariant 4.

| ID  | Covers | Steps                                                                                  | Expected                                                                                                      | How  | Result |
| --- | ------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| U1  | #75    | Open the app on an empty data dir                                                      | The first-run page: server running, `bunx gollabara setup` with a copy button, start a session                | auto | —      |
| U2  | #75    | Open it after a hook was seen, with no session today; then with an outdated hook       | Empty panels name the connected harnesses and the next step; outdated shows `golla update`                    | auto | —      |
| U3  | stream | With C4–C6 data: step the rail, open the viewer, pin a cell, let a new artifact arrive | Steps land on cells; the viewer zooms and pages; the pin holds; 「새 산출물 n →」 appears while not following | auto | —      |
| U4  | chat   | Mute a session from its avatar menu; scope to one session                              | Muted lines collapse to one system line; the scope shows only that session in both panels                     | auto | —      |
| U5  | #78    | Delete a session's data that shares an image with another session                      | Its rows leave every open view; the shared image file stays on disk; its unshared images are gone             | auto | —      |
| U6  | triage | Turn 「대화 정리」 to Claude, produce a progress-only recap and a result recap         | The progress line folds into 「숨긴 메시지 1」; the result line shows, with a tone; images are never judged   | auto | —      |
| U7  | layout | Repeat U1–U4 at 390 px and 834 px, dark and light                                      | No overflow; the chat-only layout on a phone                                                                  | auto | —      |

## History

Covers #77.

| ID  | Covers | Steps                                                                | Expected                                                                                         | How  | Result |
| --- | ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | ------ |
| H1  | #77    | Seed 35 days of messages; open 「날짜」 and pick the day 30 days ago | The chat and the rail land on that day's first message                                           | auto | —      |
| H2  | #77    | From H1, scroll up, then down to the end                             | Older pages load and the view stays put; scrolling down rejoins the live tail                    | auto | —      |
| H3  | #77    | While on an old day, post a new event                                | 「새 메시지 1 ↓」 appears and nothing jumps; pressing it returns to the latest and follows again | auto | —      |
| H4  | #77    | Type part of a session's name or branch in the 「전체 세션」 menu    | Only matching sessions are listed; picking one scopes the view                                   | auto | —      |
| H5  | #76    | Day-jump into an ended session's history                             | Its old messages are shown, faded as ended                                                       | auto | —      |

## Retention and settings

Covers #78, #79 and #98.

| ID  | Covers | Steps                                                                                                                                                       | Expected                                                                                             | How  | Result |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | ------ |
| R1  | #78    | Seed messages older and newer than 7 days, with one image only in old messages, one shared with a new message, one quoted by remaining feedback; set 7 days | Old rows are gone; the old-only image file is gone; the shared and the quoted files stay             | auto | —      |
| R2  | #98    | After R1                                                                                                                                                    | `triage_cache` rows not used in the window are gone                                                  | auto | —      |
| R3  | #78    | Leave retention unset                                                                                                                                       | Nothing is pruned; the sheet shows 「계속 보관」                                                     | auto | —      |
| R4  | #79    | Open two browser contexts on one server; change 「대화 정리」, 「보관 기간」 and 「폰용 주소」 in one                                                       | The other context shows the new values without a reload                                              | auto | —      |
| R5  | #79    | A context with `gollabara-settings` in localStorage (30 days, a phone URL) opens a server with no values                                                    | The phone URL seeds the server; the 30 days waits for 「줄이고 지우기」; cancelling keeps everything | auto | —      |
| R6  | #79    | Change the theme and 「알림 받기」 in one context                                                                                                           | The other context keeps its own                                                                      | auto | —      |

## Notifications and the installed app (desktop)

Covers MVP 3 (desktop part), #63, #64.

| ID  | Covers | Steps                                                                                                    | Expected                                                                                               | How    | Result |
| --- | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ | ------ |
| N1  | #64    | Open the settings sheet on a fresh device                                                                | 「알림 받기」 is off; no permission prompt until 「켜기」                                              | auto   | —      |
| N2  | #64    | Register a test subscription whose endpoint is a local catcher; trigger a question and a feedback answer | Two pushes; decrypted payloads are exactly `{"t":"q"}` and `{"t":"r"}`; no session text, name or image | auto   | —      |
| N3  | #64    | In real desktop Chrome, turn on 「알림 받기」 and let a session ask a question                           | A notification 「세션이 기다리고 있어요」 within 10 s; clicking it focuses the app                     | manual | —      |
| N4  | #63    | With the app open in Chrome (the service worker registered), stop the server, start it again             | The unreachable state shows while down; it reconnects within 5 s with no duplicate messages            | auto   | —      |

## Trust

Covers MVP 6, #59, #60, invariants 2 and 5.

| ID  | Covers      | Steps                                                                                           | Expected                                                                     | How  | Result |
| --- | ----------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---- | ------ |
| T1  | #59         | `GET /` with `Host: evil.example`                                                               | 403                                                                          | auto | —      |
| T2  | #59         | `POST /api/feedback` with `Origin: https://evil.example`, and with `Sec-Fetch-Site: cross-site` | 403                                                                          | auto | —      |
| T3  | #59         | `POST /api/feedback` with `Content-Type: text/plain`                                            | 415                                                                          | auto | —      |
| T4  | #59         | `/ws` upgrade with a foreign `Origin`                                                           | 403                                                                          | auto | —      |
| T5  | #60         | Open a copy of a version-0 database (with images and triage rows) with the `main` server        | `user_version` is 6; every row is still there; the UI shows the old messages | auto | —      |
| T6  | invariant 5 | Watch outbound connections during C2–F2 with triage and notifications off                       | No connection leaves the machine except the harness's own model calls        | auto | —      |

## Deferred

Remote access waits until the owner turns on Tailscale (2026-10-16): the serve spike (#61), owner-only remote writes (#62), and the iPhone checks of #63 and #64 (home-screen install, reconnect on the phone, a notification on a locked phone). The real `bunx gollabara setup` from npm waits on publishing (#67); S1 covers the same package from a local tarball.

## Manual checklist

For the owner, on their own machine:

- [ ] **S9** The service is running after a logout or reboot.
- [ ] **X2** Codex shows "Hooks need review" once, and hooks run after approving.
- [ ] **X9** Codex in Plan mode asks a `request_user_input` question, and it appears in the chat.
- [ ] **N3** Real Chrome shows 「세션이 기다리고 있어요」 within 10 s of a question.

## Runs

Each run records the commit, the date, the counts per result, and the issues it filed.

| Date | Commit | Pass | Fail | Partial | Not run | Issues |
| ---- | ------ | ---- | ---- | ------- | ------- | ------ |
