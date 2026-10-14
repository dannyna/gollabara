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

**Source.** The design source is the Open Design project `gollabara-app` ("Night Dock"). Its `app-night-dock.html` is authoritative for screens and interactions; its `DESIGN.md` records the confirmed decisions. This file carries those decisions into the repo. When the two disagree, the HTML wins. `session-chat-components.html` in the same project is the companion reference for chat rows.

The symbol is a dot inside an open viewfinder (a pair of square brackets). The frame stands for observing; the dot is the moment you pick. In the app bar the symbol sits dark on a yellow rounded square, and that yellow appears again only on what you picked and on primary actions.

gollabara is an observer, not a mediator. Night Dock draws replies, question answers, `@mention`, and pause/resume. Feedback the user writes is live (#22): the composer sends it to one session, optionally about one image, and the session picks it up through the hook. **Everything else is drawn but disabled** (see [Scope of the current build](#scope-of-the-current-build)). Nothing in the interface pushes the user to approve or decide.

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

Primary buttons darken to `oklch(.81 .14 95)` on hover.

### Named Rules

**The Three Yellows Rule.** Yellow (`--accent`) marks exactly three things: the logo symbol background, the selection outline on the selected artifact, and primary actions. Not status, not badges, not the connection state, not chosen answers or focus rings (those use `--fg`).

**The No Yellow Text Rule.** Yellow is only ever a fill or an outline. Never set text in yellow, and never put yellow text on a light surface. Content on yellow uses `--on-accent`.

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
- **Artifact track:** Inside 「산출물 스트림」, artifacts flow sideways, newest on the right. Each cell is as tall as the surface allows and as wide as the image ratio gives (`width: calc((100cqh - 209px) * var(--ratio))`). 22px between cells. Where the session changes, a dashed `--border` divider and an extra 17px separate the runs. Above each image: session, branch, mono time and size. Below: label and mono sequence number. A footer line reads 「이미지는 원래 비율 그대로」 and the follow state.
- **Follow latest:** The track follows the right end. Scrolling back pauses following (「이전 산출물 · 자동 따라가기 일시 정지」); new arrivals then raise the 「새 산출물 n →」 pill instead of moving the reader.
- **Chat feed:** 「세션 대화」 flows down: a centered date label, session messages (23px avatar, name · branch, mono time, body indented 31px), thumbnails, question cards, my bubbles aligned right, and centered system lines. The composer sits at the bottom of the chat surface.

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
- **Session menu:** A popover titled 「표시할 세션」 with the hint 「세션을 고르거나, 잠시 멈추고 음소거할 수 있어요.」. First row is 「전체 세션」 (「음소거한 세션은 숨겨요」); then one row per session with a check mark, name, branch, state (「작업 중」, 「쉬는 중」, 「멈춤」, 「음소거」), 「멈춤」/「재개」, 「음소거」/「음소거 해제」, and mono 「마지막 활동 hh:mm」. The current row gets a `--bg` fill.
  - Selecting a session changes the stream scope and closes the menu.
  - Muted sessions stay listed so they can be unmuted, but they cannot be selected.
  - Muting the selected session returns the scope to 「전체 세션」.

### Artifact cell

An image on `--surface` in a 12px cell with a 2px transparent border and the image shadow. Hover shows a `--muted` border and a floating action bar (「답장」, 「멈춤」, 「확대 ↗」). **Selected:** the border turns `--accent`; this is the selection outline. Clicking a selected cell again opens the viewer.

### Chat message and thumbnails

A 23px `--bg` avatar with the session's lowercase initial in Space Grotesk, the name and muted branch, a mono time, then the body. Thumbnails are 77px tall (120px on mobile), ratio kept, 9px corners; the one matching the selected artifact gets a 2px `--fg` inset outline. Variant labels (A/B/C) sit in a small mono tag. Hovering a message shows 「답장」 and 「멈춤」. The message linked to the selected artifact is highlighted with a `--bg` fill and a `--border` outline.

### Question card

A `--bg` card (16px radius, 16px padding) headed by a muted eyebrow 「세션에서 물었어요」, then the session's own question text. Below it, answer choices: `--surface` buttons with a `--border` line, mono letters, and a muted 「추천」 after the option the session itself recommended. A chosen answer inverts to `--fg`. 「직접 답하기」 is an underlined text button. When answered, a muted line replaces the actions: 「터미널에서 답함」, 「A로 답함 · 전달됨 ✓」, or 「직접 답변 전달됨 ✓」.

### My bubble and system line

My messages sit on the right in a `--bg` bubble with a muted quote line (「↪ session · quoted」, optional tiny image) and a 9px muted delivery note 「전달됨 ✓」 on each session's latest delivered bubble (the tooltip says how the session picked it up). A send in flight shows 「보내는 중」; a failed one shows the reason and 「다시 보내기」. Feedback the server queued but the session has not picked up yet waits in the queue tray above the composer (「대기 n건」), and becomes a bubble at the moment the session receives it. System lines are centered 10px muted text such as 「client-e2e · checkout 멈춤」 or 「api · quota-refill 음소거함」.

### Composer

A `--bg` box (16px radius, pressed-in shadow) with the placeholder 「세션에 메시지나 피드백을 남겨보세요」, an 「@ 세션」 text button, and a 34px `--fg` send button. A reply context row above shows what is quoted with a cancel button. The note below reads 「@세션을 부르거나, 산출물에 답장해 보세요」 on desktop and 「메시지를 오른쪽으로 밀면 답장」 on mobile. The mention list opens upward with 「어느 세션에 말할까요?」.

### Buttons

- **Primary:** `--accent` fill, `--on-accent` text, 600, 8px radius, 44px. Reserved for the main action of a screen.
- **Secondary:** `--surface` fill, `--border` line, 8px radius, 44px (「설정 저장」, 「이 이미지에 답장 ↗」).
- **Icon and text buttons:** 44px, no fill; hover fills `--border` (or `--bg` inside the dock).
- **New pill:** 「새 산출물 n →」, `--surface` with a `--border` line, 40px radius, floating above the track footer.
- **Focus:** every focusable element gets `outline: 2px solid var(--fg)` with a 3px offset. Disabled buttons drop to 55% opacity.

### Viewer

A full-screen dialog: a top bar (close, session · branch with mono time and size, zoom out / mono percentage / zoom in) and a bottom bar (mono index 「05 / 06」, caption, 「이 이미지에 답장 ↗」). The stage fits the image with its ratio kept; prev/next buttons sit at the edges. Zoom runs from 100% to 400% in 50% steps, by pinch, or by Ctrl + wheel; drag pans when zoomed. Arrow keys move between images.

### Settings sheet

A right-side sheet: 「서버 주소」, 「폰용 주소」 (https only), 「보관 기간」 (「7일」, 「30일」, 「계속 보관」), and the theme choice 「시스템」 / 「밝게」 / 「어둡게」, saved with 「설정 저장」. Settings live in this browser only; saving connects to nothing and deletes no files.

### Empty state

Before anything arrives the surfaces give way to a centered setup guide: a muted symbol, 「세션에서 만든 산출물이 여기에 모입니다」, 「켜 두고 구경하세요. 말을 걸고 싶을 때만 한마디.」, and three numbered steps (server running, install the Claude Code plugin with a copy button, watch from your phone with a QR code). The session menu button is hidden.

### Copy

- Name the two areas 「산출물 스트림」 and 「세션 대화」 everywhere, including accessible labels.
- Stream hint: 「산출물을 선택해 피드백을 남겨요」. Chat hint: 「질문에 답하고, 피드백을 남겨요」. Composer placeholder: 「세션에 메시지나 피드백을 남겨보세요」.
- Keep "stream" general: artifacts are not only images. Say 「이미지」 only for image-specific features such as zooming or the original-ratio note.
- Status copy only when it helps the user judge or act. Show the session's original question; never invent questions or performance numbers.
- Never present unbuilt features or sample data as real.

### Interactions

| Flow               | Behavior                                                                                                                                                                                                                                           | Current scope            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Select an artifact | Click a cell or thumbnail: the cell gets the yellow outline, the related chat message is highlighted and scrolled into view. Click again to open the viewer.                                                                                       | Live                     |
| Feedback           | Write in the composer and send to the target session. The target is the attached image's session, else the session in view, else one picked with `@`; muted sessions are never targets. With none, 「@로 보낼 세션을 골라 주세요」 blocks sending. | Live                     |
| Image feedback     | 「답장」 on a stream cell or 「이 이미지에 피드백 ↗」 in the viewer attaches the image to the composer, focuses it, and targets that image's session.                                                                                              | Live                     |
| Quote-reply        | 「답장」 on a chat message, or swipe a message right on mobile, fills the reply context in the composer.                                                                                                                                           | **Drawn, disabled**      |
| Answer a question  | Pick a choice or 「직접 답하기」. A question already answered in the terminal shows 「터미널에서 답함」 and blocks a second answer.                                                                                                                | **Drawn, disabled**      |
| `@mention`         | Typing `@` or pressing 「@ 세션」 opens the session list; arrow keys move, Enter picks. Enter sends and Shift+Enter breaks a line on desktop.                                                                                                      | Live                     |
| Pause / resume     | 「멈춤」/「재개」 in the session menu, on cells, and on messages.                                                                                                                                                                                  | **Drawn, disabled**      |
| Mute               | 「음소거」 hides a session's artifacts and messages and adds a system line.                                                                                                                                                                        | Live, client-side filter |
| Session scope      | Pick 「전체 세션」 or one session in the menu.                                                                                                                                                                                                     | Live                     |
| Browse history     | Scrolling back keeps the position when new artifacts arrive; 「새 산출물 n →」 returns to the latest.                                                                                                                                              | Live                     |
| Viewer             | Zoom, pan, prev/next, arrow keys.                                                                                                                                                                                                                  | Live                     |
| Disconnected       | Keep earlier chat, show 「다시 연결 중」 and 「연결을 기다리는 중이에요. 이전 대화는 계속 볼 수 있어요.」, block sending.                                                                                                                          | Live                     |
| Escape             | Closes the viewer, else settings, else the session menu, and always the mention list. Focus is trapped inside open dialogs and returns to the trigger.                                                                                             | Live                     |
| Theme and settings | Stored in this browser.                                                                                                                                                                                                                            | Live                     |

#### Scope of the current build

Feedback delivery is live (#22): text the user writes in the composer, optionally about one image from the stream, is queued and delivered to the session, and the UI reports it as queued (the tray), then delivered (the bubble). Sending works only from this Mac or the tailnet; elsewhere the bubble says so. Answering a session's question, quote-reply from cells and messages, and pause/resume remain a later track. Until then those controls are drawn so the layout is final, but they are disabled and must not pretend to deliver. Mute ships as a filter in the client: it hides the session in this view and sends nothing to the session.

### State acceptance

The app must reproduce each state the Night Dock HTML exposes through its query string (`app-night-dock.html?state=…`):

| State            | Query                 | What must show                                                 |
| ---------------- | --------------------- | -------------------------------------------------------------- |
| Default          | (none)                | Dark theme, both surfaces, track at the latest artifact        |
| First connection | `?state=empty`        | Setup guide; session menu button hidden                        |
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
- **Do** draw quote-reply, answers, and pause/resume disabled until they ship; feedback and `@mention` are live.

### Don't:

- **Don't** set text in yellow, and never yellow text on a light surface.
- **Don't** show image or session counts or an always-on 「구경 중」 badge in the app bar.
- **Don't** split the session control into a segmented filter plus a separate manage button.
- **Don't** let a muted session be selected, or leave the scope on a session you just muted.
- **Don't** move a reader who is browsing history when new artifacts arrive.
- **Don't** use cards with an accent stripe on the left border.
- **Don't** set numbers in a serif.
- **Don't** build anything that pushes the user to approve or decide, or invent questions for sessions.
- **Don't** present disabled or sample features as if they work.
- **Don't** write the service name in Korean.
