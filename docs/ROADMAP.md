# Roadmap

Where gollabara stands and what it takes to reach its MVP. Each item below is a GitHub issue; the issue holds the detail and this file holds the order. Update both in the same change. [E2E.md](E2E.md) holds the end-to-end scenarios that check the shipped items together.

## MVP

The MVP is done when one person can, on their own machines:

1. **Install and forget.** `bunx gollabara setup` installs the server as a login service and connects every detected harness. `golla doctor` explains anything that isn't working. Updating and uninstalling are one command each.
2. **Watch from anywhere they own.** Open the stream on the desktop and on a phone, at home or away, over HTTPS inside their Tailscale tailnet, installed to the phone's home screen. Only the owner can send feedback remotely. Nothing is exposed to the public internet. The Mac has to be awake and running the service.
3. **Know when a session needs them.** A session question reaches a locked phone within seconds as a content-free notification (decision D1).
4. **See every harness they use, at a stated level.** Each harness has a capability row (recap, question, images, feedback route) that the UI shows as it is:
   - **Claude Code**, including Open Design runs: everything, with idle wake.
   - **Codex CLI**: session, recap, and feedback at turn end and at the next tool call are required. Images and questions come as far as the spike proves.
5. **Use it every day.** First-run and empty states, ended sessions, history beyond today, retention that really deletes, and settings shared across devices.
6. **Trust it.** Hooks never block a session on any harness (checked per adapter). Requests from other origins, hosts or tailnet users are refused. Schema and plugin versions upgrade cleanly, and failures show up in `golla doctor`.

The invariants in AGENTS.md hold throughout, with one approved amendment to invariant 5 for D1.

## Status (2026-10-16)

| Milestone                 | Shipped                                                                                                                                                                 | Waiting on                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 · Remote and trust     | Migrations (#88), PWA on desktop (#90), content-free push on desktop Chrome (#92)                                                                                       | Deferred by the owner (2026-10-16) until Tailscale is on: the serve spike (#61), owner-only remote writes (#62), then the iPhone checks for #63 and #64 |
| M2 · Engineering baseline | Version handshake and health log (#89), setup/doctor/update/uninstall and the login service (#93), docs sync (#87)                                                      | Publishing to npm (#67), the owner's call                                                                                                               |
| M3 · Harness spikes       | Codex spike (#91)                                                                                                                                                       | —                                                                                                                                                       |
| M4 · Codex adapter        | Delivery routes and the Codex plugin (#94), shared hook core (#102)                                                                                                     | Codex's interactive hook-trust prompt and `request_user_input` are not yet checked live                                                                 |
| M5 · Daily-use baseline   | Retention and shared settings (#95), ended sessions (#96), first run and tray follow-ups (#99), history (#101), headless runs no longer wait on the wake-up hook (#100) | The MVP release (#80)                                                                                                                                   |

## Done: M0 foundation (Claude Code)

| Area        | Shipped                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture     | Claude Code plugin: SessionStart, PostToolUse images (including MCP), Stop recaps for user-started turns, the AskUserQuestion mirror, stable names when the cwd moves (#10/#18, #28/#29, #31/#34, #44)                                    |
| Open Design | Open Design runs go through the same plugin, tagged and named by project, and are verified end to end (#8, #12, #13)                                                                                                                      |
| Stream UI   | Night Dock shell, a rail with steps and pinning, viewer zoom and pan, stacks of repeated captures, reference-image folds, name truncation (#11/#19, #20/#23, #21/#27, #33/#36, #38/#45, #40, #41/#54, #43, #55)                           |
| Chat        | Session chat, message states, folds for hidden lines, avatar session menu with scope and mute (#16/#26, #37/#47, #39/#56)                                                                                                                 |
| Feedback    | Composer and queue tray; delivery at the next tool call, prompt or Stop; idle wake through a background Stop hook (a channel route was tried, then removed); compaction keeps a session busy (#22/#25/#30, #48/#49/#53, #51/#52, #50/#57) |
| Triage      | Opt-in show/hide and tone of chat lines, through the user's own claude or codex CLI (#32/#35, #37/#42/#47)                                                                                                                                |
| Safety      | Listens on localhost and the tailnet only (#15/#58; M1 replaces the direct tailnet bind with serve). Refuses cross-origin and DNS-rebinding requests (#59)                                                                                |

## Milestones

The harness spikes start right away, in parallel with M1 and M2, and each one has a written fallback. Abstractions wait until a second harness exists.

### M1 · Remote and trust

The owner's first goal.

- **Schema migrations** (#60). `PRAGMA user_version` with ordered migrations. Comes first because M1 adds tables. _Done when_ a v0 database fixture opens, upgrades and keeps its data, tested in CI.
- **Serve spike** (#61). `tailscale serve --bg` in front of 127.0.0.1:4747. _Done when_ all three are true or a fallback is chosen:
  - the WebSocket upgrade works through serve;
  - the iOS standalone app reconnects within 5 s after the phone has been locked for 10 minutes;
  - proxied requests carry `Tailscale-User-Login`.

  Fallbacks: if the identity header is missing, remote access is read-only. If WebSocket fails through serve, the stream falls back to SSE.

- **Remote through serve, owner-only writes** (#62).
  - The direct tailnet bind is removed, with or without serve. Without serve, the phone can't reach the server.
  - `golla setup` records the owner's `Tailscale-User-Login`.
  - Reads through serve are open to every tailnet user the ACLs let in. Writes are owner-only.
  - A request is _proxied_ when it has `X-Forwarded-For` or a `*.ts.net` Host. A proxied mutation needs `Tailscale-User-Login` to match the owner.
  - A request is _local_ only when it comes from loopback, has no forwarding headers and has a loopback Host.
  - The Origin check accepts the serve origin `https://<host>.ts.net`.
  - _Done when_ tests cover each case: the owner through serve passes; another user gets 403; a tagged node gets 403; a direct tailnet-IP request is refused; the local hook passes.
- **PWA** (#63). Manifest, icons, a service worker for the app shell, home-screen install, and a "server unreachable" state. _Done when_ the phone app reconnects within 5 s of a server restart with no duplicate messages.
- **Notifications (D1)** (#64). Opt-in Web Push whose payload holds no session text. VAPID keys live in the data directory. _Done when_ a session question reaches a locked iPhone within 10 s and the payload contains no session text.

### M2 · Engineering baseline

Has to land before a second harness ships.

- **Version handshake** (#65). Hooks send their version. _Done when_ an event from an older hook is stored and `golla doctor` shows "plugin outdated".
- **Hook health log** (#66). A size-capped local log of hook failures and latencies. _Done when_ a hook that times out shows up in `golla doctor` with its latency.
- **Distribution and service** (#67). Publish to npm. `golla setup|doctor|update|uninstall`, and a launchd login service. `doctor` warns when sleep settings will stop remote viewing.
  - _Done when_ `bunx gollabara setup` on a clean machine with bun installed leads to an event in the stream within 2 minutes.
  - _Done when_ `golla uninstall` leaves no plist, no hook entries and no data directory unless `--keep-data` is passed.
- **Docs sync** (#68). _Done when_ README "Where it stands" and AGENTS.md match the code, in both README languages.

### M3 · Harness spikes

About a week, in parallel with M1 and M2. The output is a capability row and a never-block checklist result for Codex (#69). Antigravity moved to After MVP (D6); its rows stay here for when it returns (#70).

| Unknown                                                           | Fallback if the spike fails                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Codex: images in the PostToolUse `tool_response`                  | Read images from file paths in `tool_input`                      |
| Codex: hooks under `codex exec` and app-server                    | Open Design Codex runs are a stated gap                          |
| Codex: whether hooks see `request_user_input`                     | No question mirror for Codex                                     |
| Codex: hook trust re-prompts on every rebuild                     | A stable shim that loads a versioned bundle                      |
| Codex: sandbox and PATH                                           | An absolute bun path, or a node-compatible bundle                |
| Antigravity: recap from `transcriptPath`                          | Session presence plus images from `artifactDirectoryPath`        |
| Antigravity: feedback through Stop `continue` (with a loop guard) | `injectSteps` at the next PostInvocation, otherwise observe only |
| Antigravity: hooks under `agy -p`                                 | A stated gap                                                     |

### M4 · Codex adapter

- **Delivery routes** (#71). Neutral routes in `types.ts` (`next-tool`, `next-prompt`, `turn-end`, `idle-wake`). The composer and the queue tray show each session's routes. _Done when_ a Codex session's tray states its real route.
- **Codex plugin** (#72). A plugin plus a marketplace entry: SessionStart, the recap from `last_assistant_message`, and images and questions as far as the spike proved. Feedback goes through additionalContext and Stop `block` with a loop guard. `golla setup` installs it and walks the user through hook trust.
  - _Done when_ the never-block checklist passes as `bun test` against recorded payloads: a hard deadline, exit 0 on every path, nothing breaks when the server is down, a loop guard, and p95 under 300 ms.
  - _Done when_ a live Codex session appears next to a Claude Code session.

- **Shared hook core** (#74). Extract it once two adapters exist (Claude Code and Codex). _Done when_ every adapter's tests pass unchanged on top of it.

### M5 · Daily-use baseline

- **First run** (#75). _Done when_ an empty stream names the connected harnesses and what to run next.
- **Session lifecycle** (#76). Ended sessions fade out, and feedback to an ended session is refused with a clear message. _Done when_ a session that ended is marked within a minute.
- **History** (#77). _Done when_ a 30-day-old message can be reached through a day jump, and sessions can be filtered by name.
- **Retention** (#78). A server-side setting replaces the current local one, which deletes nothing. There is also "delete this session's data".
  - _Done when_ an image file used only by expired messages is gone from disk, while a file still shared with a newer message stays.
- **Settings across devices** (#79). _Done when_ everything except theme and server URL is stored on the server.
- **MVP release** (#80). A version tag, both READMEs updated.

## After MVP

- Antigravity CLI (Google): the spike (#70) and adapter (#73), once a Pro subscription is available.
- Adapters for Gemini CLI (Enterprise only), Cursor, GitHub Copilot CLI and opencode (#81).
- Claude Design, observed only through its Claude Code handoff (#83).
- Idle wake for harnesses other than Claude Code (Codex app-server, Cursor `followup_message`) (#82).
- HTML artifact preview.
- Several machines feeding one stream (#84).

## Decisions

- **D1 Notifications:** In the MVP, as opt-in, content-free Web Push. The owner approved an amendment to invariant 5 (2026-10-15): only an encrypted ping with no content leaves the machine. Triggers are session questions, plus the first recap after feedback was delivered to that session (Codex may have no question mirror).
- **D2 Gemini CLI:** After the MVP.
- **D3 Distribution:** npm and bunx before the MVP. bun stays the runtime.
- **D4 Remote feedback:** Allowed, for the owner's identity only.
- **D5 Hook token:** Not added. The local-versus-proxied rule plus the Origin and Host checks cover it, and a token would silently break plugins that are already installed.
- **D6 Antigravity:** After the MVP. No Pro subscription is available for the spike, so the MVP's harnesses are Claude Code (with Open Design runs) and Codex CLI.
