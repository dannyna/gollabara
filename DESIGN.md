---
name: gollabara
description: "Night Dock: a dark dock for watching what sessions make"
colors:
  dark-bg: "oklch(0.220704 0.009062 255.6084)"
  dark-surface: "oklch(0.274908 0.010907 254.0192)"
  dark-fg: "oklch(0.966197 0.003428 247.8584)"
  dark-muted: "oklch(0.769881 0.016843 253.9307)"
  dark-border: "oklch(0.395448 0.015664 255.6039)"
  light-bg: "oklch(0.972666 0.001711 247.8392)"
  light-surface: "oklch(1.000000 0.000000 89.8756)"
  light-fg: "oklch(0.266235 0.009457 248.1828)"
  light-muted: "oklch(0.492867 0.015485 251.6888)"
  light-border: "oklch(0.877533 0.008140 253.8593)"
  accent: "oklch(0.871579 0.150779 94.9011)"
  accent-hover: "oklch(0.81 0.14 95)"
  on-accent: "oklch(0.267 0.009 250)"
  shade: "oklch(0 0 0 / 0.2)"
  dark-ok: "oklch(0.80 0.12 160)"
  dark-warn: "oklch(0.82 0.12 70)"
  dark-risk: "oklch(0.74 0.14 25)"
  light-ok: "oklch(0.50 0.11 160)"
  light-warn: "oklch(0.55 0.12 60)"
  light-risk: "oklch(0.53 0.17 25)"
typography:
  wordmark:
    fontFamily: "Space Grotesk, Noto Sans KR, sans-serif"
    fontSize: "25px"
    fontWeight: 500
    letterSpacing: "-1.3px"
  heading:
    fontFamily: "Noto Sans KR, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.6px"
  title:
    fontFamily: "Noto Sans KR, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  body:
    fontFamily: "Noto Sans KR, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
  message:
    fontFamily: "Noto Sans KR, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "Noto Sans KR, sans-serif"
    fontSize: "11px"
    fontWeight: 500
  mono:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
rounded:
  label: "6px"
  button: "8px"
  thumb: "9px"
  control: "12px"
  bubble: "15px 15px 4px 15px"
  card: "16px"
  dock: "17px"
  popover: "18px"
  surface: "24px"
  pill: "40px"
spacing:
  dock-inset: "4px"
  xs: "6px"
  sm: "9px"
  md: "12px"
  surface-gap: "16px"
  app-gutter: "18px"
  message-gap: "20px"
  track-gap: "22px"
  stream-inset: "26px"
components:
  app-bar:
    backgroundColor: "{colors.dark-bg}"
    textColor: "{colors.dark-fg}"
    height: "92px"
    padding: "0 10px"
  logo-symbol:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.button}"
    size: "30px"
  control-dock:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.dock}"
    height: "54px"
    padding: "4px"
  session-menu-button:
    backgroundColor: "{colors.dark-bg}"
    textColor: "{colors.dark-fg}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 12px"
  stream-surface:
    backgroundColor: "{colors.dark-bg}"
    rounded: "{rounded.surface}"
  chat-surface:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.surface}"
    width: "440px"
  artifact-cell:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.control}"
  artifact-cell-selected:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.control}"
  chat-thumbnail:
    backgroundColor: "{colors.dark-bg}"
    rounded: "{rounded.thumb}"
    height: "77px"
  question-card:
    backgroundColor: "{colors.dark-bg}"
    textColor: "{colors.dark-fg}"
    typography: "{typography.message}"
    rounded: "{rounded.card}"
    padding: "16px"
  answer-choice:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-fg}"
    typography: "{typography.mono}"
    rounded: "{rounded.control}"
    height: "44px"
  my-bubble:
    backgroundColor: "{colors.dark-bg}"
    textColor: "{colors.dark-fg}"
    typography: "{typography.message}"
    rounded: "{rounded.bubble}"
    padding: "9px 13px"
  composer:
    backgroundColor: "{colors.dark-bg}"
    textColor: "{colors.dark-fg}"
    typography: "{typography.message}"
    rounded: "{rounded.card}"
    padding: "9px 10px 8px"
  primary-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.button}"
    height: "44px"
    padding: "0 18px"
  secondary-button:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-fg}"
    rounded: "{rounded.button}"
    height: "44px"
    padding: "0 14px"
  new-pill:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-fg}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 18px"
  session-menu:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-fg}"
    rounded: "{rounded.popover}"
    width: "390px"
    padding: "16px"
---

# Design System: gollabara

## Overview

**Creative North Star: "Night Dock"**

gollabara is a UX engineer's viewfinder for watching, from one step back, the artifacts that Open Design, Claude Code, Codex, and Claude Design sessions produce. It stays open on a side monitor or phone all day. Night Dock is a near-monochrome dark developer surface: two separate rounded work surfaces sit on a darker ground, a small tool dock floats on the right of the app bar, and the screenshots and mockups take center stage.

**Source.** The design source is the Open Design project `gollabara-app` ("Night Dock"). Its `app-night-dock.html` is authoritative for screens and interactions; its `DESIGN.md` records the confirmed decisions. This file carries those decisions into the repo. When the two disagree, the HTML wins. `session-chat-components.html` in the same project is the companion reference for chat rows, and `message-state-components.html` for recap line states, hidden-line rows, and session start rows.

The symbol is a dot inside an open viewfinder (a pair of square brackets). The frame stands for observing; the dot is the moment you pick. In the app bar the symbol sits dark on a yellow rounded square, and that yellow appears again only on what you picked and on primary actions.

gollabara is an observer, not a mediator. Night Dock draws replies, question answers, and `@mention`. Pausing a session is out of scope and not drawn. Feedback the user writes is live (#22): the composer sends it to one session, optionally about one image or replying to one of its messages, and the session picks it up through the hook. Answering a Claude Code session's own question is live and opt-in (「앱에서 답하기」): a card answers only while the session's hook holds the question. **Every other question card is drawn read-only**: outside a hold, and for Codex (see [Scope of the current build](#scope-of-the-current-build)). Nothing in the interface pushes the user to approve or decide.

**Key Characteristics:**

- Dark by default, with light and system themes as alternatives
- Two independent rounded surfaces: 「산출물 스트림」 (artifact stream) and 「세션 대화」 (session chat)
- One right-side tool dock holding a single session menu button, theme, and settings
- Yellow on three things only: the logo symbol background, the selection outline, and primary actions
- The image's own aspect ratio sets each column's width
- Numbers, times, and sizes in monospace

## Colors

A cool-gray neutral palette in OKLch with one saturated yellow. Every color is a token; the theme swaps the five neutrals and leaves the accent alone.

The app starts with `data-theme="dark"` on `<html>`. The user can pick 「시스템」, 「밝게」, or 「어둡게」 in settings, or flip between light and dark with the theme button in the dock. System mode removes `data-theme` and follows `prefers-color-scheme`.

| Token         | Dark (default)                      | Light                               | Role                                                                               |
| ------------- | ----------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `--bg`        | `oklch(0.220704 0.009062 255.6084)` | `oklch(0.972666 0.001711 247.8392)` | App ground, stream surface, question cards, my bubbles, composer box, menu buttons |
| `--surface`   | `oklch(0.274908 0.010907 254.0192)` | `oklch(1.000000 0.000000 89.8756)`  | Chat surface, dock, image cells, popovers, sheets, answer choices                  |
| `--fg`        | `oklch(0.966197 0.003428 247.8584)` | `oklch(0.266235 0.009457 248.1828)` | Text, focus ring, send button, chosen answer fill                                  |
| `--muted`     | `oklch(0.769881 0.016843 253.9307)` | `oklch(0.492867 0.015485 251.6888)` | Times, hints, states, captions, hover outlines                                     |
| `--border`    | `oklch(0.395448 0.015664 255.6039)` | `oklch(0.877533 0.008140 253.8593)` | Hairlines, stream surface inset ring, generic button hover                         |
| `--accent`    | `oklch(0.871579 0.150779 94.9011)`  | same                                | Logo symbol background, selection outline, primary actions                         |
| `--on-accent` | `oklch(.267 0.009 250)`             | same                                | Content on accent: the symbol mark, primary button text                            |
| `--shade`     | `oklch(0 0 0 / .2)`                 | same                                | Shadow color for floating layers                                                   |
| `--ok`        | `oklch(.80 .12 160)`                | `oklch(.50 .11 160)`                | Recap line state 성공 (`success`): icon, box border and fill only                  |
| `--warn`      | `oklch(.82 .12 70)`                 | `oklch(.55 .12 60)`                 | Recap line state 주의 (`warning`), amber pushed towards orange                     |
| `--risk`      | `oklch(.74 .14 25)`                 | `oklch(.53 .17 25)`                 | Recap line state 위험 (`danger`)                                                   |

Primary buttons darken to `oklch(.81 .14 95)` on hover.

### Named Rules

**The Three Yellows Rule.** Yellow (`--accent`) marks exactly three things: the logo symbol background, the selection outline on the selected artifact, and primary actions. Not status, not badges, not the connection state, not chosen answers or focus rings (those use `--fg`).

**The No Yellow Text Rule.** Yellow is only ever a fill or an outline. Never set text in yellow, and never put yellow text on a light surface. Content on yellow uses `--on-accent`.

**The State Color Rule.** The surface stays near-monochrome: no warning colors, not even for failures. The one exception is the state of a session's recap lines. Success (`--ok`, h160), warning (`--warn`, h60–70, an amber pushed towards orange so it never reads as the accent yellow), and danger (`--risk`, h25) color only the icon, the 1px box border (35%), and a faint fill (8%). Body text stays `--fg` in every state. There is no info state: a shown line is already worth reading, and that is the default. Delivery failures, the composer, and question cards stay achromatic.

## Typography

**Display Font:** Space Grotesk (fallback: Noto Sans KR, sans-serif)
**Body Font:** Noto Sans KR (fallback: sans-serif)
**Mono Font:** IBM Plex Mono (fallback: monospace)

**Character:** Space Grotesk is reserved for the wordmark and session initials; Noto Sans KR carries everything else at small, dense sizes (`word-break: keep-all` for Korean). Machine-made values are set apart in IBM Plex Mono with tabular figures, so they read differently from human sentences.

### Hierarchy

- **Wordmark** (500, 25px, -1.3px; 24px on mobile): the lowercase `gollabara` in the app bar.
- **Heading** (700, 19px, -0.6px): sheet and dialog titles such as 「설정」; the session menu title 「표시할 세션」 is 16px.
- **Title** (600, 12px): surface titles 「산출물 스트림」 and 「세션 대화」, the session menu button.
- **Body** (400, 13px, 1.65): the base size.
- **Message** (400, 12px, 1.8): chat message bodies, question text, my bubbles, the composer.
- **Label** (400–600, 10–11px): sender names, hints, session states, button text in menus and action bars.
- **Mono** (400, 9–11px, tabular): times, image sizes (`1440 × 900`), sequence numbers (`06`), viewer index (`05 / 06`), zoom (`100%`), answer letters.

### Named Rules

**The Mono Numbers Rule.** Times, sizes, counts, and sequence numbers are set in IBM Plex Mono with tabular figures. Never set numbers in a serif.

**The Latin Name Rule.** The service name is written in Latin letters only, never in Korean. The wordmark is always lowercase `gollabara`.

## Layout

Night Dock is an app bar over two separate rounded work surfaces with an 18px gutter around them (`.app { padding: 0 18px 18px }`) and a 16px gap between them.

| Width       | Arrangement                                                                                                                | App bar                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ≥ 1280px    | Stream left (fluid), chat right (440px)                                                                                    | 92px, one row: identity left, dock right                       |
| 1024–1279px | Stream left (fluid), chat right (440px)                                                                                    | 88px, one row                                                  |
| 768–1023px  | Stacked: stream on top (about 43% height), chat below; 14px gutter, 12px gap                                               | 88px, one row                                                  |
| ≤ 767px     | Chat only, full bleed, top corners rounded (22px). The stream surface is hidden; tapping a chat thumbnail opens the viewer | 120px, two rows: identity (56px) over a full-width dock (54px) |

- **App bar:** Logo symbol and wordmark on the left; the control dock on the right. The dock is a `--surface` capsule (54px, 4px inset, 17px radius) holding the session menu button, the theme button, and the settings button. On mobile the dock spans the full width and the session button stretches.
- **Artifact track:** Inside 「산출물 스트림」, artifacts flow sideways, newest on the right. Each cell is as tall as the surface allows and as wide as the image ratio gives (`width: calc((100cqh - 209px) * var(--ratio))`). Consecutive cells from one session within 5 minutes form a run: 10px between them, and only the first names the session (later cells keep the row empty so faces line up). Between runs (another session, a new day, or a longer pause) the gap is 22px plus a dashed `--border` divider and an extra 17px. Above each image: session and branch on the run's first cell, then mono time, file name (middle-truncated, full path on hover) when known, and size. Below: label, a muted 「같은 화면 n장」 when earlier captures of the same screen are hidden behind this one, and the mono sequence number. The wheel, a trackpad swipe, and ←/→ move the rail one cell at a time, landing its left edge on the rail's content start. A resize keeps the reader's place: the latest cell on the anchor while following, the pinned cell on the anchor, or the first cell in view where it was. A footer line reads 「이미지는 원래 비율 그대로」 and the follow state.
- **Follow latest:** The track follows the right end. Scrolling back pauses following (「이전 산출물 · 자동 따라가기 일시 정지」); new arrivals then raise the 「새 산출물 n →」 pill instead of moving the reader. **Pinned:** clicking a cell's image pins it, one cell at a time. Following stops and the rail holds that cell in place while arrivals only raise the pill. Moving the rail sideways (a wheel step, ←/→, a swipe) lets go of the pin and of any selection outline, a thumbnail's included: the reader has left the cell, and following resumes only when the move lands on the latest. The footer reads 「고정한 산출물 · Esc로 풀기」 (「고정한 산출물 · 다시 눌러 풀기」 on touch screens), with how to let go in `--fg`; the arrival count shows only on the pill. Clicking the pinned cell again, Esc when no menu, viewer or dialog is open, moving the rail, or the pill lets go, and the cell's selection outline goes with it; the pill also jumps to the latest and follows again. A pinned cell that leaves the rail (a new scope, a muted session) lets go of the pin. The pin is kept in this browser and comes back after a reload while its cell is still in the stream. A new capture of the pinned screen moves its cell to the end but keeps the pin; the view stays where the reader was.
- **Chat feed:** 「세션 대화」 flows down: a centered date label, session start rows left-aligned in the message column, session messages (23px avatar, name · branch, mono time, body indented 31px), thumbnails, question cards, 「숨긴 메시지 n」 rows where triage hid lines, my bubbles aligned right, and centered system lines (mute and connection changes). Only the date label and those system lines are centered. The composer sits at the bottom of the chat surface.

**The Image Sets the Width Rule.** Artifact cells and chat thumbnails keep the original aspect ratio and are never cropped (`object-fit: contain`, or fixed height with `width: auto`). Only the tiny quote previews in a reply context or a sent bubble may use `cover`.

## Elevation & Depth

Depth comes from the two-tone ground (`--bg` under `--surface`) and a small set of soft shadows tinted from black. Shadows separate layers; they never decorate text.

| Layer                     | Treatment                                                    |
| ------------------------- | ------------------------------------------------------------ |
| Chat surface              | `--surface`, `0 8px 25px oklch(0 0 0 / .08)`                 |
| Stream surface            | `--bg`, `inset 0 0 0 1px var(--border)` (a ring, not a lift) |
| Image in a cell           | `0 10px 24px oklch(0 0 0 / .2)`                              |
| Composer box              | `inset 0 1px 4px oklch(0 0 0 / .13)` (pressed in)            |
| Hover action bars         | `0 3px 14px var(--shade)` on cells, `0 3px 9px` on messages  |
| New-artifacts pill, toast | `0 5px 24px var(--shade)` / `0 5px 25px var(--shade)`        |
| Session menu              | `0 12px 45px var(--shade)`                                   |
| Mention list              | `0 -8px 30px var(--shade)` (opens upward)                    |
| Settings sheet            | Right-side sheet over an `oklch(0 0 0 / .38)` scrim          |
| Viewer                    | Opaque full-screen `--bg` dialog with `--surface` bars       |

**The Two Grounds Rule.** Separate with tone before shadow: `--bg` for ground and recessed fills, `--surface` for anything lifted. Add a shadow only to the layers listed above.

## Shapes

Soft, generous corners that grow with size: 6px thumbnail labels, 8px buttons and the logo symbol, 9px chat thumbnails, 11–12px dock controls, image cells, and answer choices, 16px question cards and the composer box, 17px dock, 18px popovers, 24px work surfaces (20px on tablet, 22px top corners on mobile). The new-artifacts pill is fully rounded (40px). My bubbles have one tight corner (`15px 15px 4px 15px`) that points to the sender.

The symbol's open bracket frame is a square-cornered stroke (40 on a 512 grid) around a round dot (r 42). In the app bar it is drawn in `--on-accent` on a 30px `--accent` square with an 8px radius.

On mobile and coarse pointers every control is at least 44px (answer choices 46px). On desktop, primary controls stay at 44px while hover action bars and inline text buttons run 32–36px.

## Components

Component structure is provisional. An atomic component system comes later; today's Vue components in `web/src` are screen-level. The descriptions below are visual contracts, not a component API.

### App bar and session menu

- **Identity:** Logo symbol plus wordmark. 「다시 연결 중」 appears next to it in muted text **only** while disconnected. No image or session counts and no always-on 「구경 중」 badge.
- **Session menu button:** A single `--bg` button in the dock showing 「전체 세션」 or the selected session's name, with a muted chevron. Hover and open state add an inset `--muted` ring. Do not split it back into a segmented filter plus a separate manage button.
- **Session menu:** A popover titled 「표시할 세션」 with the hint 「볼 세션을 고르거나, 음소거해 숨길 수 있어요.」, then the search field (「세션 검색 · 끝난 세션도 찾아요」), then 「전체 세션」 (「음소거한 세션은 숨겨요」), then one compact row per session (OD `session-menu-v2.html`, draft 5). A row starts with a 23px harness monogram, a 1px `--border` rounded square on `--bg` holding a mono 10px letter: C for Claude Code, X for Codex, O for Open Design, D for Claude Design, or the name's first letter for a session known only from its messages. The monogram turns `--muted` when the row is muted or ended. Next comes the name as `name · branch`, with the collision hint before it. Under the name is one 10px `--muted` meta line: a state mark and word (● 「작업 중」, ■ 「기다리는 중」, ○ 「쉬는 중」, ○ 「끝남」), prefixed 「음소거 · 」 when muted, then the harness name and `·` with the mono relative last activity (「방금」, 「n분 전」, 「n시간 전」, 「어제」, else `M/D`). A row with no state shows no state word. On the right sits a small 「표시」/「숨김」 switch (`role="switch"`, named 「<name> 표시」, 48×44 hit area): mute inverted, so off means muted. The whole row except the switch picks the scope. The current scope, 「전체 세션」 or a session, gets only a `--bg` fill and `aria-pressed`. It has no check mark and no border, and never yellow. Hover is a half step from `--surface` toward `--bg`, and keyboard focus is the 2px `--fg` outline inset. A muted 11px foot reads 「표시 스위치를 끄면 전체 세션에서 숨겨요.」. On mobile the bottom sheet has a small `--border` grabber at its top (decorative). The anchored variant has none.
  - **Live only:** with an empty search, only live sessions are listed (a record that has not ended: working, waiting and idle all count). Ended sessions and sessions known only from their messages are left out until the user searches. With no live session, a muted 「실행 중인 세션이 없어요」 takes the rows' place, styled like the no-match line, and the search field stays.
  - Selecting a session changes the stream scope and closes the menu.
  - Muted sessions stay listed so they can be unmuted (an ended one through a search), but they cannot be selected.
  - Muting the selected session returns the scope to 「전체 세션」.
  - **Finding a session:** a search field 「세션 검색 · 끝난 세션도 찾아요」 sits under the hint, above 「전체 세션」, a 40px `--bg` field (44px on touch) with 12px corners, pressed in like the composer. It narrows the session rows by name (with its parent path hint, when it has one) or branch as you type, and a search also finds ended and message-only sessions, so their messages can still be scoped until they expire; 「전체 세션」 always stays. With no match, a muted 「이름이 맞는 세션이 없어요」 replaces the rows. Opening the menu keeps focus on its close button, so a tap on the phone never raises the keyboard.
- **Avatar menu:** The avatar and name in a session message's head are one button (the time stays out); it opens a small menu with the session menu's two actions for that session, so the result is the same as doing them there, plus deleting that session's data (OD `session-chat-components.html` 07).
  - **Button:** Looks like the plain head until hovered or focused; then its surface takes `--fg` 7%, the avatar gains an inset `--muted` ring, and a muted ⌄ follows the name. 29px tall (44px on touch screens, where the ⌄ always shows), growing inward so the head keeps its height. While open it keeps the surface and adds a `--border` line.
  - **Menu:** Opens 7px under the head, aligned to the avatar's left edge, 224px wide (never wider than the screen minus 48px): a `--surface` panel, 1px `--border`, 12px corners, `0 12px 32px var(--shade)`. The first row names the session in mono 10px muted. Three 36px rows (44px on touch) with a 15px muted icon: 「이 세션만 보기」 (「전체 세션 보기」 when scoped to that session), 「음소거」 (「음소거 해제」 when muted), and 「이 세션 데이터 삭제」 (a trash icon). Delete opens a centered confirm dialog (「… 세션의 데이터를 지울까요?」, 「지우기」, Cancel focused first; never the browser's confirm()); once the server removes the rows, every open view drops them. Hover is an `--fg` 8% fill. No yellow and no state color; the row text says the state.
  - **Muted sessions:** Their messages are gone, so the menu opens from the small avatar and name in the system line 「… 음소거함」, centred under the line. There 「이 세션만 보기」 is disabled with a muted 「음소거 중」 at its right, as in the session menu.
  - **Keys:** Enter or Space opens it with focus on the first row (a click leaves focus on the button); ↑ ↓ Home End move and skip disabled rows (`role="menu"`, `menuitem`, `aria-haspopup="menu"`, `aria-expanded`). Picking a row runs it and closes the menu. Escape, Tab, or a press outside closes it and focus returns to the button; Escape closes only this menu.

### Artifact cell

An image on `--surface` in a 12px cell with a 2px transparent border and the image shadow. Hover shows a `--muted` border and a floating action bar (「답장」, 「확대 ↗」). **Selected:** the border turns `--accent`; this is the selection outline. **Pinned:** the same selection outline plus a 24px pin badge at the face's top left (an `--ink` circle with a 2px white ring and a white pin, so its edge reads on light and dark captures) and a pin before the caption's sequence number, which turns `--fg`. Yellow stays the outline's alone. Clicking a cell selects and pins it; clicking the pinned cell unpins it and drops the outline. Double-clicking a cell opens the viewer and leaves the cell pinned (its second click is not a toggle). The viewer also opens from 「확대 ↗」 or a chat thumbnail.

### Chat message and thumbnails

A 23px `--bg` avatar with the session's lowercase initial in Space Grotesk, the name and muted branch, a mono time, then the body. The name is one line: the dir is never cut, only a long branch ends in 「…」, and the full name is in the tooltip. Session start rows use the same rule; the stream cell name follows it in a later change.

**Names that collide.** When two known sessions share a name (two checkouts called `e2e-app`), each gets a muted parent path before the dir, `repo/e2e-app` and `repo2/e2e-app`: the fewest parent directories of its project that no other session with that name ends with, read from the session's `cwd` (`web/src/names.ts`). A path that runs out before it differs starts at the root (`/x/`); sessions with the same path, or no record to read it from, get none. Labels that show the whole name (chat head, avatar menu and its header, session menu, the session menu button, start rows, stream cell, mention list) collide on the whole name; labels that show only the dir (queue tray, composer target, my bubble's target) collide on the dir, so `e2e-app` and `e2e-app · feat` are told apart there too. The hint is `--muted` at 400 and gives way after the branch; it is part of the tooltip and the menu's accessible name, and the session menu's search matches it. A name that collides with nothing reads exactly as before. Thumbnails are 77px tall (120px on mobile), ratio kept, 9px corners; the one matching the selected artifact gets a 2px `--fg` inset outline. Variant labels (A/B/C) sit in a small mono tag. Hovering or focusing a message that has a recap line shows 「답장」 in a floating bar above its head (hidden at 767px and below); it quotes the message in the composer, and is disabled once the session ended. On touch, dragging such a message right does the same: the message follows the finger with a reply cue behind it, resists past 56px, where the cue fills `--fg`, and quotes the message on release there; a shorter drag springs back. Only a drag that heads clearly right counts, so vertical scrolling and the thumbnail strip keep theirs, and a swipe that starts on the head does not open the avatar menu. The feed clips sideways, so the message slides under its edge. Questions and image-only turns get no bar. Pausing a session is out of scope, so there is no 「멈춤」 anywhere. The message linked to the selected artifact is highlighted with a `--bg` fill and a `--border` outline.

### Ended sessions

A session ends when its harness says so or its process goes away. An ended session fades with `--muted` colour, never with opacity. No inline 「끝남」 follows its name: in the chat the dashed avatar marks it too, and screen readers still hear 「끝남」 in the head's and the cell's names. The session menu leaves ended sessions out unless the user searches. Images are never faded: the stream shows what it received. An hour after a session ends, the server deletes its record, messages, feedback and images, and every open view drops them; a session that comes back within the hour stays.

- **Chat message:** the avatar loses its `--bg` fill for a 1px dashed `--border` outline, the same outline a start row's square has, and its initial turns `--muted`. The name and the body text turn `--muted`; no 「끝남」 follows the name, but the button's accessible name carries 「끝남」. Thumbnails and state boxes keep their own colours.
- **Avatar menu:** the button fades like the head. The menu's first row reads 「session · 끝남」, and every row still works.
- **Artifact cell:** the run's session name turns `--muted`, with a visually hidden 「끝남」 for screen readers. The image, the meta line and the caption are unchanged.
- **Session menu:** an ended session is listed only when a search finds it. Its row's name and monogram turn `--muted`, and the meta line's state reads ○ 「끝남」 (「음소거 · 끝남」 when it is also muted) in place of a live state, which tells it apart from live rows in the results. Its 표시 switch stays, since its messages are kept until it expires. It can still be selected until it expires.
- **Composer:** with an ended target, sending is blocked with 「끝난 세션이에요」, like the other blocked reasons. The draft stays. `@` does not offer ended sessions. A send the server refuses because the session ended reads the same on the failed bubble.
- **Queue tray:** items queued before the session ended stay in the tray, faded to `--muted` with a dashed avatar. In place of a route, the group says 「끝나서 전달할 수 없어요」. When every waiting session has ended, the header says 「끝난 세션이라 전달할 수 없어요」. A session that resumes within the hour picks the items up as usual; otherwise they expire with it. Each of its items has a plain 「지우기」 text button that discards it on the server, for every view; there is no confirm, since only an undeliverable item can go. Groups are keyed by session id, so two sessions with the same directory name never share one, and their labels carry the parent path that tells them apart (see **Names that collide**).

### Triage

Only when 「대화 정리」 is on (off by default; off, every line is 기본). Triage decides whether a recap line is shown and, if so, its state.

- **States:** 기본, 성공, 주의, 위험 (`default`, `success`, `warning`, `danger`). All four share one box: 5px 10px padding, a 1px border, 10px corners, reaching back over the 31px indent so the state icon (15px) sits in the avatar column and the text starts where it does in 기본. 기본 has a transparent border, no fill and no icon, so a late verdict only changes color and the text never moves. 성공 is a check in a circle, 주의 a warning triangle, 위험 an × in a circle; screen readers hear 「성공: 」 and the like before the text. Colors follow the State Color Rule. Lines of one turn sit 4px apart.
- **Latest state only:** within a session only the most recent stated line is a filled box. Earlier stated lines drop the fill and border and keep their icon. A 기본 line does not clear an earlier state. The app never says 「해결됨」: it can't tell whether a success resolved an earlier failure.
- **Images and questions:** in a turn with images the box wraps only the recap line; thumbnails stay outside it. Question cards never carry a state.
- **Hidden lines:** there is no heading toggle. Where lines were hidden, a 28px muted row 「숨긴 메시지 n」 takes their place: an eye-off icon in the avatar column, a mono count, a chevron, and the mono time span at the right end. Consecutive hidden lines merge into one row, even across sessions; anything drawn between them splits it. Inside a multi-line turn the row sits in the message at the gap. Expanded (「숨긴 메시지 n 접기」), the lines sit inside a `--border` hairline in the avatar column as `--muted` 11px text (not opacity), each under a mono 9px 「session · time」, with no avatar, box or thumbnails.
- **Timing:** a new recap-only line (no images, not a question) waits up to 10 s for its verdict before it shows, so a line the model hides never flashes in. A line already shown is never removed by a later hide verdict: it dims in place to `--muted` 11px, and after a reload it folds into a row. Turns with images and question cards are never hidden.

### Question card

A `--bg` card (16px radius, 16px padding) headed by a muted eyebrow (the question icon and the session's header, or 「세션에서 물었어요」, with 「· 여러 개 고르기」 for a multiSelect), then the session's own question text. Below it, answer choices: up to three short labels without descriptions sit side by side as `--surface` buttons with a `--border` line and mono labels; anything else gets one row per option (a round mark, or a square one for multiSelect, the label in 500 and the description in `--muted`). A muted 「추천」 follows the option the session itself recommended. A chosen answer inverts to `--fg` (short buttons) or gets a `--fg` border and a filled mark (rows). 「직접 답하기」 is an underlined muted text button.

The card answers only while the session's `ask` hook holds the question: 「앱에서 답하기」 is on, the session is a live Claude Code one, the question has a call id, and the app is connected. Every other question (Codex, ended sessions, a hold that ran out, the setting off, older rows) is drawn exactly as before, every control disabled but at full contrast, so the question stays readable. While held:

- **Countdown.** A muted 10px line under the actions, 「52초 안에 답하면 바로 전달돼요」, ticks down each second (`role="timer"`, so it is not announced every tick).
- **Pick.** A single-select choice sends at once. A multiSelect toggles rows and sends with the primary 「n개 골라 보내기」 (「골라 주세요」 and disabled with none picked). The answer is the option's own label, multiSelect labels joined with ", ".
- **Typed.** 「직접 답하기」 swaps the choices for a text field (`--surface`, a 1px `--fg` inset line, 12px radius, up to 2000 characters, 16px text on mobile) with 「선택지로 돌아가기」 and a primary 「보내기」. Text that is not a label is a valid answer.
- **Sending.** The choices lock, only the pick keeps `--fg`, and a spinner line reads 「B로 답하는 중」.
- **Done.** 「B로 답했어요 · 14:36」 with a `--fg` check; a typed answer shows its text in place of the label.
- **Fail.** No red: the alert icon and `--fg` text. When the hold had already ended (409), 「시간이 지나 터미널로 넘어갔어요」 and nothing more: the session's own dialog has taken over. On a network error, 「전달하지 못했어요 · 다시 보내기」 and 「터미널에서 바로 답해도 돼요」; the choices stay open and the countdown stays while the hold lasts, else everything locks. From a source outside this Mac or the tailnet, 「이 Mac이나 tailnet에서만 답할 수 있어요」.
- **Terminal.** Answered in the session's terminal first, the card closes with 「터미널에서 B로 먼저 답했어요」 (or the typed text, or 「터미널에서 먼저 답했어요」 when the answer is unknown), so it can't be answered twice.
- **Offline.** The choices lock; 「다시 연결되면 답할 수 있어요」 shows only while the hold still has time.

The stored answer wins over everything: once the server records one (`via: 'terminal'` or `'app'`), the card shows it, whichever came first.

When a session asks several questions at once, one card holds the whole set and shows one question at a time (`QuestionStepper.vue`; the Open Design file `question-card-v3.html`, variant 5). The current question fills a `--bg` card (16px radius, 14px padding): the question icon and the header on one line, the question in 14px 500, then the options. Not held, they are read-only rows, not buttons: a mono number in an 18px `--border` box, the label in `--muted` 11px 500 (a muted 10px 「추천」 after the recommended one), and the description under it in `--muted` 10px, and the card says nothing about answering. At its foot, centred 12px under the options, an indicator steps through the set: a ‹ button, one dot per question, a › button. The arrows are 28px with a 16px `--muted` chevron (`--fg` on hover); on the first or last question the arrow that leads nowhere is disabled and faint (0.35) but keeps its place, so the indicator never shifts. Each dot is a 6px `--border` dot in an 18px button, named 「질문 n · header」; the current one is a 16px `--fg` pill with `aria-current="step"`. ‹ and › are named 「앞 질문 보기 · …」 and 「다음 질문 보기 · …」. The current step is view state only, starting at the first question. Every question sits in one grid cell and only the current one is visible, so the card keeps the height of its tallest question and stepping never moves the chat below it. ←/→ are not used: they belong to the stream rail and the viewer. Tab reaches the arrows and the dots, and Enter or Space presses them; when the pressed arrow turns disabled, focus moves to the other one. A single question keeps the plain card, with no indicator.

While held, each page's options become buttons like the card's rows (`--surface`, `--border` line, 12px radius, the label in `--fg`; picked, a `--fg` border and a filled number box with a check). Picking a single-select option records it and steps to the next question, and focus follows into the new page. A multiSelect toggles, and the user steps on with ›. 「직접 답하기」 under the options types an answer for the current question; the field shares the options' grid cell, so it never changes the card's height, and 「선택지로 돌아가기」 brings the options back. A dot fills `--muted` once its question has an answer (named 「… · 답함」). The last page shows the primary 「n개 답 보내기」 at the right of that row, enabled only when every question has an answer; it keeps its place, hidden, on the other pages, so the height holds. Everything goes in one request. The countdown line sits above the indicator. Sending, the card collapses to a summary with a spinner, 「답 n개 보내는 중」; answered, to a muted summary headed 「앱에서 모두 답했어요 · 14:36」 (`--fg`) or 「터미널에서 모두 답했어요」, then each header with its answer (typed text as written; 「터미널에서 답했어요」 when the terminal's pick is unknown). A failure keeps the pages, with the same fail lines as the card. Sending disables or replaces the control that sent, so focus moves to the card, or to the summary, instead of dropping to the page; the single card does the same.

### My bubble and system line

My messages sit on the right in a `--bg` bubble with a muted quote line (「↪ session · quoted」, optional tiny image) and a 9px muted delivery note 「전달됨 ✓」 on each session's latest delivered bubble (the tooltip says how the session picked it up). A send in flight shows 「보내는 중」; a failed one shows the reason and 「다시 보내기」. Feedback the server queued but the session has not picked up yet waits in the queue tray above the composer (「대기 n건」), and becomes a bubble. The tray header says how it will be delivered, from the waiting sessions' routes: 「바로 전달돼요」 when every one has a live wake-up hook, 「세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요」 for sessions reached at the next tool call, prompt or turn end (Codex, or Claude Code without a waiter). When the sessions differ, it reads 「세션마다 전달 시점이 달라요」 and each group names its own route after the session, muted. A queued item then becomes a bubble at the moment the session receives it. System lines are centered 10px muted text such as 「api · quota-refill 음소거함」, where the small avatar and name open the avatar menu.

Session starts are not system lines. A start row is left-aligned in the message column: a 23px dashed `--border` square with the start icon in the avatar column, the name (dir `--fg` 500, muted branch), 「시작」, and a mono time at the right end. Starts with nothing between them, within 5 minutes, group 2px apart; with 4 or more, three show and the rest fold into an underlined 「외 n개」. The gap below is 8px when the next item is a message from one of those sessions, 20px otherwise.

### Composer

A `--bg` box (16px radius, pressed-in shadow) with the placeholder 「세션에 메시지나 피드백을 남겨보세요」, an 「@ 세션」 text button, and a 34px `--fg` send button. A reply context row above shows what is quoted with a cancel button: an artifact as a tiny thumbnail with 「↪ session · caption」, a chat message as 「↪ session · recap line」 with no thumbnail, one line and ellipsized. The note below reads 「@세션을 부르거나, 산출물에 답장해 보세요」 on desktop and 「메시지를 오른쪽으로 밀면 답장」 on mobile. Once a target session is set, the target's route takes the hint's place at every width, in the same muted style and with the tray's copy (「바로 전달돼요」 or 「세션이 다음 작업을 하거나 턴을 마칠 때 전달돼요」). The mention list opens upward with 「어느 세션에 말할까요?」.

### Buttons

- **Primary:** `--accent` fill, `--on-accent` text, 600, 8px radius, 44px. Reserved for the main action of a screen.
- **Secondary:** `--surface` fill, `--border` line, 8px radius, 44px (「설정 저장」, 「이 이미지에 답장 ↗」).
- **Icon and text buttons:** 44px, no fill; hover fills `--border` (or `--bg` inside the dock).
- **New pill:** 「새 산출물 n →」, `--surface` with a `--border` line, 40px radius, floating above the track footer.
- **Focus:** every focusable element gets `outline: 2px solid var(--fg)` with a 3px offset. Disabled buttons drop to 55% opacity.

### Viewer

A full-screen dialog: a top bar (close, session · branch with mono time and size, zoom out / mono percentage / zoom in) and a bottom bar (mono index 「05 / 06」, caption, 「이 이미지에 답장 ↗」). The stage fits the image with its ratio kept; prev/next buttons sit at the edges. Zoom runs from 100% to 400% in 50% steps, by pinch, or by Ctrl + wheel; drag pans when zoomed. Arrow keys move between images. A cell hiding earlier captures adds a pager to the bottom bar (「3 / 5 · 같은 화면」, ↑/↓) that starts at the newest, and 「따로 보기」 gives the capture on screen its own cell. Feedback targets the capture on screen.

### Settings sheet

A right-side sheet: 「서버 주소」, 「폰용 주소」 (https only), the theme choice 「시스템」 / 「밝게」 / 「어둡게」, 「대화 정리」 「끄기」 / 「Claude」 / 「Codex」, and the 「앱에서 답하기」 switch, saved with 「설정 저장」. Everything but the theme and 「서버 주소」 is stored on the server, so every device shows the same values, and changing them works only from this Mac or the tailnet; 「서버 주소」 stays in this browser. Theme and 「대화 정리」 apply at once instead. Its note says that message text and the user's feedback text go to that CLI's model and images do not. 「앱에서 답하기」 is a switch on its label's line (`role="switch"`, a 25×14 track that fills `--fg` when on, with a muted 「켜짐」 / 「꺼짐」, 44px hit area), off by default and applied at once on the server. Its note: 「세션이 물으면 60초 동안 여기서 답할 수 있어요. 그동안 터미널에는 질문이 보이지 않아요. Claude Code 세션만 돼요.」 「알림 받기」 「끄기」 / 「켜기」 also applies at once, for this device only, and asks for notification permission only when 「켜기」 is clicked. Its note says that only a content-free signal leaves the Mac. When the browser blocked notifications, has no push, or is Safari on iPhone (push reaches only the home-screen app), both buttons are disabled and the note says why, in muted text with no alert.

### Empty state

The Night Dock source has no first-run screen yet; these states are drawn within this file and the existing components (#75). What is connected comes only from what the server knows: the hooks `GET /api/health` heard from per harness (version, last seen, outdated) and the sessions.

- **First-run page.** Before any message or session exists, the surfaces give way to a centered guide: a muted symbol, 「세션에서 만든 산출물이 여기에 모입니다」, 「켜 두고 구경하세요. 말을 걸고 싶을 때만 한마디.」, and three numbered steps. 1 server (「서버 실행 중 ✓」, or 「서버를 켜 주세요」 with `bunx gollabara setup`); 2 「Claude Code나 Codex 연결」, with `bunx gollabara setup` while no harness ever posted, the harness list once one did, and `golla update` when a hook is outdated; 3 「세션을 시작해 보세요」. The first step not done is current (`--fg` disc); later ones wait in muted text. Commands sit in mono in a `--surface` box with a 44px copy button. The session menu button is hidden.
- **Empty panels.** Once a session exists the workspace shows, and an area with nothing in view keeps its muted one-line title (「아직 산출물이 없어요.」, 「이 세션에는 아직 산출물이 없어요.」, 「아직 대화가 없어요.」) and adds the guide under it: a 12px-corner `--border` list of harnesses (name 600 `--fg`, 「연결됨」 with a check, or 「플러그인이 오래됐어요」 with the alert icon and the hook's mono version, then the mono last-seen time, or `M/D` before today), or 「아직 연결된 하네스가 없어요」 with a plug, and then the next step: a 13px 600 title, a muted line and, when it has one, a command to copy.
- **Next step.** No harness ever posted: 「플러그인을 설치해 주세요」 with `bunx gollabara setup`. A hook outdated: 「세션을 다시 시작해 주세요」 with `golla update`. No session running today: 「세션을 시작해 보세요」. A session running: 「세션이 만든 이미지가 여기에 모여요」 in the stream, 「세션이 턴을 마치면 여기에 보여요」 in the chat. Scoped to one session, only its harness is listed, and an ended one reads 「끝난 세션이에요」.
- **No color, drawn once.** Outdated is said in words and an icon, never `--warn`, and nothing is yellow. In the chat the harness list shows only at ≤767px, where the stream is hidden; wider, the stream carries it and the chat shows only the next step.

### Copy

- Name the two areas 「산출물 스트림」 and 「세션 대화」 everywhere, including accessible labels.
- Stream hint: 「산출물을 선택해 피드백을 남겨요」. Chat hint: 「질문에 답하고, 피드백을 남겨요」. Composer placeholder: 「세션에 메시지나 피드백을 남겨보세요」.
- Keep "stream" general: artifacts are not only images. Say 「이미지」 only for image-specific features such as zooming or the original-ratio note.
- Status copy only when it helps the user judge or act. Show the session's original question; never invent questions or performance numbers.
- Never present unbuilt features or sample data as real.

### Interactions

| Flow               | Behavior                                                                                                                                                                                                                                                                                                                                                        | Current scope            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Select an artifact | Click a cell or thumbnail: the cell gets the yellow outline, the related chat message is highlighted and scrolled into view. Clicking a cell also pins it (click again to unpin and drop the outline); double-clicking a cell or 「확대 ↗」 opens the viewer, and so does clicking a thumbnail again.                                                           | Live                     |
| Feedback           | Write in the composer and send to the target session. The target is the attached image's session, else the session in view, else one picked with `@`; muted sessions are never targets. With none, 「@로 보낼 세션을 골라 주세요」 blocks sending.                                                                                                              | Live                     |
| Image feedback     | 「답장」 on a stream cell or 「이 이미지에 피드백 ↗」 in the viewer attaches the image to the composer, focuses it, and targets that image's session.                                                                                                                                                                                                           | Live                     |
| Quote-reply        | 「답장」 on a session's recap message, or swiping it right on touch, targets that session and fills the reply context with its recap line; the bubble and the delivered feedback carry the quote. Disabled for an ended session.                                                                                                                                | Live                     |
| Answer a question  | With 「앱에서 답하기」 on, a Claude Code question card answers while the session's hook holds it (up to 60 s, a countdown shows): pick a choice, or 「직접 답하기」; a question set sends all its answers at once. A question already answered in the terminal shows 「터미널에서 … 먼저 답했어요」 and blocks a second answer. Other questions stay read-only. | Live, opt-in             |
| `@mention`         | Typing `@` or pressing 「@ 세션」 opens the session list; arrow keys move, Enter picks. Enter sends and Shift+Enter breaks a line on desktop.                                                                                                                                                                                                                   | Live                     |
| Mute               | 「음소거」 in the session menu or a session's avatar menu hides its artifacts and messages and adds a system line.                                                                                                                                                                                                                                              | Live, client-side filter |
| Triage             | With 「대화 정리」 on, lines the model hides fold into 「숨긴 메시지 n」 rows in place, and shown lines carry a state (기본 · 성공 · 주의 · 위험).                                                                                                                                                                                                              | Live, opt-in             |
| Session scope      | Pick 「전체 세션」 or one session in the menu, or 「이 세션만 보기」 / 「전체 세션 보기」 in a session's avatar menu.                                                                                                                                                                                                                                           | Live                     |
| Browse history     | Scrolling back, or pinning a cell, keeps the position when new artifacts arrive; 「새 산출물 n →」 returns to the latest and lets go of the pin. Reaching the start loads older messages in place. Far from the latest, both pills read 「최신으로」 even with nothing new.                                                                                     | Live                     |
| Viewer             | Zoom, pan, prev/next, arrow keys.                                                                                                                                                                                                                                                                                                                               | Live                     |
| Disconnected       | Keep earlier chat, show 「다시 연결 중」 and 「연결을 기다리는 중이에요. 이전 대화는 계속 볼 수 있어요.」, block sending.                                                                                                                                                                                                                                       | Live                     |
| Escape             | Closes the viewer, else settings, else the session menu or an avatar menu, and always the mention list. Focus is trapped inside open dialogs and returns to the trigger.                                                                                                                                                                                        | Live                     |
| Theme and settings | Stored in this browser.                                                                                                                                                                                                                                                                                                                                         | Live                     |

#### Scope of the current build

Feedback delivery is live (#22): text the user writes in the composer, optionally about one image from the stream or quoting one session message, is queued and delivered to the session, and the UI reports it as queued (the tray), then delivered (the bubble). Sending works only from this Mac or the tailnet; elsewhere the bubble says so. Answering a Claude Code session's own question is live too, opt-in, while the session's hook holds it (see [Question card](#question-card)). Pausing a session is out of scope. Mute ships as a filter in the client: it hides the session in this view and sends nothing to the session.

### State acceptance

The app must reproduce each state the Night Dock HTML exposes through its query string (`app-night-dock.html?state=…`):

| State            | Query                 | What must show                                                 |
| ---------------- | --------------------- | -------------------------------------------------------------- |
| Default          | (none)                | Dark theme, both surfaces, track at the latest artifact        |
| First connection | `?state=empty`        | Setup guide with the next step; session menu button hidden     |
| Session menu     | `?state=sessions`     | Session menu open under its button                             |
| Viewer           | `?state=viewer`       | Full-screen viewer on an artifact                              |
| Mention          | `?state=mention`      | Composer holding `@` with the mention list open                |
| Disconnected     | `?state=disconnected` | 「다시 연결 중」 in the app bar, note in chat, sending blocked |
| Answered         | `?state=answered`     | Scope on one session; its question shows 「터미널에서 답함」   |
| New artifacts    | `?state=new`          | Track scrolled back with 「새 산출물 2 →」 visible             |
| Settings         | `?state=settings`     | Settings sheet open                                            |
| Light theme      | `?theme=light`        | Same default screen in the light tokens                        |

On every state: no horizontal page scroll on mobile, visible focus, and text and icon contrast kept in hover and selected states.

## Do's and Don'ts

### Do:

- **Do** start in the dark theme and define every token for dark (default) and light in `web/src/style.css`.
- **Do** keep yellow to the logo symbol background, the selection outline, and primary actions.
- **Do** use `--fg` for focus rings, chosen answers, and the active thumbnail.
- **Do** keep one session menu button that shows 「전체 세션」 or the selected session.
- **Do** set times, sizes, counts, and sequence numbers in IBM Plex Mono.
- **Do** let the original ratio set image width, uncropped.
- **Do** separate with `--bg` and `--surface` before reaching for a shadow.
- **Do** draw answers disabled until they ship; feedback, quote-reply and `@mention` are live. Pausing a session is out of scope (invariant 1), so it is not drawn at all.

### Don't:

- **Don't** set text in yellow, and never yellow text on a light surface.
- **Don't** color body text with a state, use state colors outside recap lines, or label a line 「해결됨」.
- **Don't** show image or session counts or an always-on 「구경 중」 badge in the app bar.
- **Don't** split the session control into a segmented filter plus a separate manage button.
- **Don't** let a muted session be selected, or leave the scope on a session you just muted.
- **Don't** move a reader who is browsing history when new artifacts arrive.
- **Don't** use cards with an accent stripe on the left border.
- **Don't** set numbers in a serif.
- **Don't** build anything that pushes the user to approve or decide, or invent questions for sessions.
- **Don't** present disabled or sample features as if they work.
- **Don't** write the service name in Korean.
