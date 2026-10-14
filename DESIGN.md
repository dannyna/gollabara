---
name: gollabara
description: "A quiet viewfinder that watches the artifacts, not the sessions"
colors:
  quiet-paper: "#F5F6F7"
  card-white: "#FFFFFF"
  recess-gray: "#ECEEF0"
  hairline: "#D3D7DC"
  graphite-ink: "#22262A"
  slate-muted: "#5B626A"
  signal-yellow: "#F4D34F"
  signal-ink: "#7A6200"
  live-green: "#2F7D5B"
  night-paper: "#181B1F"
  night-card: "#24282D"
  night-recess: "#1F2327"
  night-hairline: "#41474F"
  night-ink: "#F2F4F6"
  night-muted: "#ADB5BF"
  night-live-green: "#5FC495"
typography:
  wordmark:
    fontFamily: "Space Grotesk, Noto Sans KR, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  body:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
rounded:
  tag: "3px"
  thumb: "5px"
  chip: "8px"
  card: "10px"
  field: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  2xl: "24px"
components:
  observe-badge:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  pill-button:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.quiet-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  filter-chip:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 9px"
  filter-chip-on:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.quiet-paper}"
    rounded: "{rounded.pill}"
    padding: "4px 9px"
  question-card:
    backgroundColor: "{colors.recess-gray}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
  question-option:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.chip}"
    padding: "5px 11px"
  session-avatar:
    textColor: "{colors.card-white}"
    rounded: "{rounded.chip}"
    size: "30px"
  app-header:
    height: "56px"
    padding: "0 24px"
---

# Design System: gollabara

## Overview

**Creative North Star: "구경 모드 · Quiet signal"**

gollabara is a UX engineer's viewfinder for watching, from one step back, the artifacts that Open Design, Claude Code, Codex, and Claude Design sessions produce. It stays open on a side monitor or phone all day, so the surface is as quiet as a near-monochrome developer tool and the screenshots and mockups take center stage. Color shows up only when there is a signal: a single yellow means "watching now" and "what you picked," and everything else is divided by hairlines and whitespace.

The symbol is a dot inside an open viewfinder (a pair of square brackets). The frame stands for observing; the dot is the moment you pick. Both meanings run through the whole system: surfaces left open like the frame, and yellow placed as rarely as the dot.

gollabara is an observer, not a mediator, and the interface carries that stance. No modals, alarm colors, or big calls to action pushing you to decide. Questions from sessions are only mirrored, so they are drawn so they never look like something you must press.

**Key Characteristics:**

- Near-monochrome surfaces plus one signal yellow
- Flat, shadowless; depth from 1px hairlines and one recessed tone
- The image's own aspect ratio sets each column's width
- Numbers, times, and sizes in monospace
- Light and dark as equals, following the system setting

## Colors

A cool-gray neutral palette where one saturated yellow appears only as a signal.

### Primary

- **Signal Yellow** (`signal-yellow`): The brand's only accent: the fill of the "watching" badge (「구경 중」), the outline of the selected image column, and the app icon background. Same value in light and dark.
- **Signal Ink** (`signal-ink`): A deep ochre that stands in for yellow text on light screens: the "asked by the session" label (「세션이 물은 질문」) and the selected column's session name. In dark mode Signal Yellow takes this role.

### Neutral

- **Quiet Paper** / **Night Paper** (`quiet-paper` / `night-paper`): The app background.
- **Card White** / **Night Card** (`card-white` / `night-card`): One layer up: image column backgrounds, filter chips, question options.
- **Recess Gray** / **Night Recess** (`recess-gray` / `night-recess`): One step below the background: question cards and the highlight on a chat message linked to the selected column.
- **Hairline** / **Night Hairline** (`hairline` / `night-hairline`): The 1px line for panel edges, header rules, chip borders, and the dashed session divider.
- **Graphite Ink** / **Night Ink** (`graphite-ink` / `night-ink`): Body and heading text; also inverted as the fill of selected filter chips and pill buttons.
- **Slate Muted** / **Night Muted** (`slate-muted` / `night-muted`): Secondary info such as times, counts, and empty-state hints.

### Status

- **Live Green** / **Night Live Green** (`live-green` / `night-live-green`): Only for the "following latest" indicator (「최신을 따라가는 중」) and the connection dot. A status signal, never decoration.

### Session hues

Each session gets a hue hashed from its id, painted as `hsl(h 45% 42%)`. It appears only on the 30px session avatar and the 8px dot in an image column's meta line. Fixed saturation and lightness keep every session color quieter than the signal yellow.

### Named Rules

**The Surface-Only Yellow Rule.** Yellow is only ever a fill or an outline. Never yellow text on a light screen; use Signal Ink instead.

**The One Signal Rule.** On any screen, yellow marks only the "watching" badge and the current selection. Its rarity is what makes it mean "you picked this."

## Typography

**Display Font:** Space Grotesk (fallback: Noto Sans KR, system-ui)
**Body Font:** Noto Sans KR (fallback: Apple SD Gothic Neo, system-ui)
**Label/Mono Font:** IBM Plex Mono (fallback: ui-monospace)

**Character:** Geometric Space Grotesk is reserved for the wordmark; plain Noto Sans KR carries the rest. Numbers and machine-made values are set apart in IBM Plex Mono so they read differently from human sentences. Fonts are bundled via `@fontsource` and look the same offline.

### Hierarchy

- **Wordmark** (700, 16px, -0.01em): The lowercase `gollabara` in the header, nowhere else.
- **Title** (700, 15px): Panel titles, such as "Stream" (「스트림」).
- **Body** (400, 14px, 1.5): Recaps and question text; long paths and URLs break with `overflow-wrap: anywhere`.
- **Label** (400–700, 12–13px): Filter chips, badges, sender names, meta info.
- **Mono** (400, 11px): Times, image sizes (`1280×800`), counts.

### Named Rules

**The Mono Numbers Rule.** Machine-made numbers (times, sizes, counts) are set in monospace. Never set numbers in a serif.

**The Latin Name Rule.** The service name is written in Latin letters only, never in Korean. The wordmark is always lowercase `gollabara`.

## Layout

The desktop is a two-column grid where two flows run at right angles. In the left content panel (fluid width) images flow sideways; in the right chat panel (fixed 440px) recaps and questions flow down. Both panels have a 56px header, and a 1px Hairline separates headers and panels.

- **Image track:** Each column is the track height minus 64px tall, as wide as the image's ratio allows. 18px between columns, 28px side padding. A dashed vertical divider marks where the session changes.
- **Follow latest:** The track follows the newest (right) end by default. Scrolling back pauses following and shows a "new images n →" pill (「새 이미지 n →」).
- **Chat feed:** 16px 20px padding, 14px between messages. Selecting an image column highlights its message in Recess Gray.
- **Mobile (≤767px):** The content panel hides and only chat remains. Thumbnails grow to 96px tall and open the full-screen viewer on tap.

**The Image Sets the Width Rule.** Track columns keep the original aspect ratio and are never cropped (`object-fit: contain`). Only thumbnails may use `cover`.

## Elevation & Depth

A flat, shadowless system. Depth comes only from three tonal layers (Paper → Card → Recess) and the 1px Hairline. The one layer that floats above the app is the full-screen viewer, an 85% black scrim (`rgb(0 0 0 / .85)`) over everything.

**The Flat-By-Default Rule.** No `box-shadow` on cards, chips, or panels. If you need more separation, change the tonal layer or add a Hairline.

## Shapes

Soft but never bubbly corners, scaling with size: 3px session dots, 5px thumbnails, 8px avatars and options, 10px image columns and question cards, 12px input area. Chips, badges, and buttons are full pills (999px), so shape alone separates "things you press" from "things that hold."

The symbol's open bracket frame is a square-cornered stroke (40–44 on a 512 grid) around a round dot. The app icon is a Graphite Ink symbol on Signal Yellow, a rounded square with a 112px radius on a 512 grid.

## Components

### Observe badge

The only yellow label, announcing that the screen is "watching."

- **Style:** Signal Yellow fill, Graphite Ink text, 12px 700, pill (3px 9px).
- **Placement:** Exactly one, right next to the wordmark in the content header.

### Buttons

- **Pill button:** Rare actions like "new images n →": an inverted pill, Paper text on Graphite Ink (5px 12px, 12px).
- **No primary CTA:** There is no big primary button, because gollabara never asks you to act first.

### Chips

- **Filter chip:** Session filter. Card fill with a Hairline border by default, inverted to Graphite Ink when selected (4px 9px, 12px). The row scrolls sideways with the scrollbar hidden.
- **Question option:** An option from a session's question. Card fill, Hairline border, 8px corners. A static label, not a button, with no hover response.

### Cards / Containers

- **Image column:** An image on Card, 10px corners, 1px Hairline, topped by one line of session dot, name, and mono meta (time, size). When selected it gets a 3px Signal Yellow outline (2px offset) and the session name turns Signal Ink.
- **Question card:** Recess Gray fill, 1px Hairline, 10px corners, 10px 12px padding, headed by an 11px Signal Ink label saying the session asked it.
- **Stream message:** A 30px session avatar (session-hue square with white initials), then sender name, time, and kind (such as "turn end" 「턴 끝」 or "images n"), then the body. Thumbnails are 48px tall and keep their ratio.

### Status indicators

- **Live dot:** A 7px Live Green dot with a 12px "following latest" label.
- **Connection dot:** A 7px dot in the chat header: Live Green when connected, Slate Muted while reconnecting.

### Viewer

Double-click an image (tap on mobile) to show the original, fitted to the screen, over an 85% black scrim. Clicking anywhere on the scrim closes it. Pinch zoom works on mobile.

## Do's and Don'ts

### Do:

- **Do** use yellow only as a fill or outline, for the "watching" badge and the current selection.
- **Do** use Signal Ink (`#7A6200`) when a light screen needs yellow-family text.
- **Do** set times, sizes, and counts in IBM Plex Mono.
- **Do** let the original ratio set image column width, uncropped.
- **Do** try the tonal layers (Paper, Card, Recess) and the Hairline before adding a color.
- **Do** define new tokens for both light and dark in `web/src/style.css`.

### Don't:

- **Don't** use cards with an accent stripe on the left border.
- **Don't** set numbers in a serif.
- **Don't** put shadows on cards, chips, or panels.
- **Don't** draw a session's question options as pressable buttons; they are only mirrored.
- **Don't** build modals, alarm colors, or big primary buttons that push the user to approve or decide.
- **Don't** write the service name in Korean.
