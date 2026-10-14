---
name: gollabara
description: "세션이 아니라 산출물을 구경하는 조용한 관측창 · A quiet viewfinder that watches the artifacts, not the sessions"
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

gollabara는 Open Design · Claude Code · Codex · Claude Design 세션이 내놓는 산출물을 한 발짝 밖에서 지켜보는 UX 엔지니어의 관측창입니다. 옆 모니터나 폰에 하루 종일 켜 두는 화면이므로, 표면은 거의 흑백인 개발 도구처럼 조용하고 스크린샷과 시안이 화면의 주인공이 됩니다. 색은 신호가 필요한 순간에만 등장합니다. 노랑 한 가지가 「지금 구경 중」과 「사용자가 고른 것」을 뜻하고, 나머지는 얇은 경계와 여백으로 구획합니다.

gollabara is a UX engineer's viewfinder for watching, from one step back, the artifacts that Open Design, Claude Code, Codex, and Claude Design sessions produce. It stays open on a side monitor or phone all day, so the surface is as quiet as a near-monochrome developer tool and the screenshots and mockups take center stage. Color shows up only when there is a signal: a single yellow means "watching now" and "what you picked," and everything else is divided by hairlines and whitespace.

심볼은 열린 뷰파인더(좌우 대괄호 프레임) 안의 한 점입니다. 프레임은 관찰을, 점은 사용자가 고르는 순간을 뜻합니다. 이 두 의미가 시스템 전체로 이어집니다. 프레임처럼 비워 두는 표면, 점처럼 드물게 찍히는 노랑입니다.

The symbol is a dot inside an open viewfinder (a pair of square brackets). The frame stands for observing; the dot is the moment you pick. Both meanings run through the whole system: surfaces left open like the frame, and yellow placed as rarely as the dot.

gollabara는 관찰자이지 중재자가 아닙니다. 화면도 그 태도를 따릅니다. 결정을 재촉하는 모달, 경고색, 큰 행동 유도 버튼을 두지 않습니다. 세션이 물은 질문도 비추기만 하므로, 눌러야 할 것처럼 보이지 않게 그립니다.

gollabara is an observer, not a mediator, and the interface carries that stance. No modals, alarm colors, or big calls to action pushing you to decide. Questions from sessions are only mirrored, so they are drawn so they never look like something you must press.

**Key Characteristics:**

- 거의 흑백인 무채색 표면 + 신호 노랑 한 가지 · Near-monochrome surfaces plus one signal yellow
- 그림자 없는 평면, 1px 경계와 한 단계 낮은 면으로만 깊이 표현 · Flat, shadowless; depth from 1px hairlines and one recessed tone
- 이미지 원본 비율이 칸 너비를 결정 · The image's own aspect ratio sets each column's width
- 숫자 · 시각 · 크기는 모노 서체 · Numbers, times, and sizes in monospace
- 라이트와 다크를 동등하게 지원(시스템 설정을 따름) · Light and dark as equals, following the system setting

## Colors

차가운 회색 계열의 무채색 위에, 채도 높은 노랑 하나가 신호로만 찍히는 팔레트입니다.

A cool-gray neutral palette where one saturated yellow appears only as a signal.

### Primary

- **Signal Yellow** (`signal-yellow`): 브랜드의 유일한 강조색입니다. 「구경 중」 배지의 면, 선택된 이미지 칸의 윤곽선, 앱 아이콘 바탕에 씁니다. 라이트와 다크에서 같은 값입니다. / The brand's only accent: the fill of the "watching" badge, the outline of the selected image column, and the app icon background. Same value in light and dark.
- **Signal Ink** (`signal-ink`): 밝은 화면에서 노랑을 글자로 써야 할 때 대신 쓰는 짙은 황토색입니다. 「세션이 물은 질문」 라벨, 선택된 칸의 세션 이름에 씁니다. 다크에서는 Signal Yellow가 이 역할을 맡습니다. / A deep ochre that stands in for yellow text on light screens: the "asked by the session" label and the selected column's session name. In dark mode Signal Yellow takes this role.

### Neutral

- **Quiet Paper** / **Night Paper** (`quiet-paper` / `night-paper`): 앱 전체 바탕 · The app background.
- **Card White** / **Night Card** (`card-white` / `night-card`): 이미지 칸 배경, 필터 칩, 질문 선택지처럼 바탕 위에 한 겹 올라온 면 · One layer up: image column backgrounds, filter chips, question options.
- **Recess Gray** / **Night Recess** (`recess-gray` / `night-recess`): 바탕보다 한 단계 낮은 면. 질문 카드와, 이미지 칸과 연결된 채팅 메시지 강조 · One step below the background: question cards and the highlight on a chat message linked to the selected column.
- **Hairline** / **Night Hairline** (`hairline` / `night-hairline`): 패널 경계, 헤더 아래 선, 칩 테두리, 세션 구분 점선에 쓰는 1px 선 · The 1px line for panel edges, header rules, chip borders, and the dashed session divider.
- **Graphite Ink** / **Night Ink** (`graphite-ink` / `night-ink`): 본문과 제목 글자색. 선택된 필터 칩과 알약 버튼의 면에 반전해서도 씀 · Body and heading text; also inverted as the fill of selected filter chips and pill buttons.
- **Slate Muted** / **Night Muted** (`slate-muted` / `night-muted`): 시각, 개수, 빈 상태 안내 같은 보조 정보 · Secondary info such as times, counts, and empty-state hints.

### Status

- **Live Green** / **Night Live Green** (`live-green` / `night-live-green`): 「최신을 따라가는 중」 표시와 서버 연결 점에만 씁니다. 상태 신호이며 장식으로 쓰지 않습니다. / Only for the "following latest" indicator and the connection dot. A status signal, never decoration.

### Session hues

세션마다 id 해시로 색상(hue)을 뽑아 `hsl(h 45% 42%)`로 칠합니다. 세션 아바타(30px 사각)와 이미지 칸 메타의 8px 점에만 씁니다. 채도와 명도를 고정해 어떤 세션 색도 신호 노랑보다 튀지 않게 합니다.

Each session gets a hue hashed from its id, painted as `hsl(h 45% 42%)`. It appears only on the 30px session avatar and the 8px dot in an image column's meta line. Fixed saturation and lightness keep every session color quieter than the signal yellow.

### Named Rules

**The Surface-Only Yellow Rule.** 노랑은 면과 윤곽선으로만 씁니다. 밝은 화면에서 노랑 글자는 쓰지 않고 Signal Ink로 대신합니다. / Yellow is only ever a fill or an outline. Never yellow text on a light screen; use Signal Ink instead.

**The One Signal Rule.** 한 화면에서 노랑이 칠해지는 곳은 「구경 중」 배지와 현재 선택 하나뿐입니다. 노랑이 드물어야 「사용자가 고른 것」이라는 뜻이 살아납니다. / On any screen, yellow marks only the "watching" badge and the current selection. Its rarity is what makes it mean "you picked this."

## Typography

**Display Font:** Space Grotesk (Noto Sans KR, system-ui 대체 · fallback)
**Body Font:** Noto Sans KR (Apple SD Gothic Neo, system-ui 대체 · fallback)
**Label/Mono Font:** IBM Plex Mono (ui-monospace 대체 · fallback)

**Character:** 기하학적인 Space Grotesk는 워드마크에만 쓰고, 화면의 나머지는 담백한 Noto Sans KR이 맡습니다. 숫자와 기계가 만든 값은 IBM Plex Mono로 분리해 사람이 쓴 문장과 구분합니다. 서체는 `@fontsource`로 번들해 오프라인에서도 같게 보입니다. / Geometric Space Grotesk is reserved for the wordmark; plain Noto Sans KR carries the rest. Numbers and machine-made values are set apart in IBM Plex Mono so they read differently from human sentences. Fonts are bundled via `@fontsource` and look the same offline.

### Hierarchy

- **Wordmark** (700, 16px, -0.01em): 헤더의 소문자 `gollabara`. 다른 곳에는 쓰지 않음 · The lowercase `gollabara` in the header, nowhere else.
- **Title** (700, 15px): 패널 제목(「스트림」) · Panel titles.
- **Body** (400, 14px, 1.5): 리캡, 질문 본문. 긴 경로나 URL은 `overflow-wrap: anywhere`로 끊음 · Recaps and question text; long paths and URLs break with `overflow-wrap: anywhere`.
- **Label** (400–700, 12–13px): 필터 칩, 배지, 발신자 이름, 메타 정보 · Filter chips, badges, sender names, meta info.
- **Mono** (400, 11px): 시각, 이미지 크기(`1280×800`), 개수 · Times, image sizes, counts.

### Named Rules

**The Mono Numbers Rule.** 시각 · 크기 · 개수처럼 기계가 만든 숫자는 모노 서체로 씁니다. 숫자에 세리프 서체를 쓰지 않습니다. / Machine-made numbers (times, sizes, counts) are set in monospace. Never set numbers in a serif.

**The Latin Name Rule.** 서비스명은 영문으로만 쓰고 한글 표기를 두지 않습니다. 워드마크는 항상 소문자 `gollabara`입니다. / The service name is written in Latin letters only, never in Korean. The wordmark is always lowercase `gollabara`.

## Layout

데스크톱은 두 흐름이 직교하는 2열 그리드입니다. 왼쪽 콘텐츠 패널(가변 너비)에서는 이미지가 가로로 흐르고, 오른쪽 채팅 패널(440px 고정)에서는 리캡과 질문이 세로로 흐릅니다. 두 패널 모두 56px 높이의 헤더를 갖고, 헤더 아래와 패널 사이는 1px Hairline으로 나눕니다.

The desktop is a two-column grid where two flows run at right angles. In the left content panel (fluid width) images flow sideways; in the right chat panel (fixed 440px) recaps and questions flow down. Both panels have a 56px header, and a 1px Hairline separates headers and panels.

- **이미지 트랙 · Image track:** 각 칸은 트랙 높이에서 64px을 뺀 높이를 갖고, 너비는 이미지 원본 비율을 따릅니다. 칸 사이 18px, 트랙 좌우 여백 28px. 세션이 바뀌는 지점에 점선 세로 구분선을 둡니다. / Each column is the track height minus 64px tall, as wide as the image's ratio allows. 18px between columns, 28px side padding. A dashed vertical divider marks where the session changes.
- **최신 따라가기 · Follow latest:** 기본으로 트랙은 최신(오른쪽 끝)을 따라갑니다. 사용자가 과거로 스크롤하면 따라가기를 멈추고 「새 이미지 n →」 알약 버튼을 띄웁니다. / The track follows the newest (right) end by default. Scrolling back pauses following and shows a "new images n →" pill.
- **채팅 피드 · Chat feed:** 패딩 16px 20px, 메시지 간격 14px. 이미지 칸을 고르면 연결된 메시지가 Recess Gray로 강조됩니다. / 16px 20px padding, 14px between messages. Selecting an image column highlights its message in Recess Gray.
- **모바일 · Mobile (≤767px):** 콘텐츠 패널을 숨기고 채팅만 보입니다. 썸네일은 96px 높이로 키우고, 탭하면 전체 화면 뷰어로 엽니다. / The content panel hides and only chat remains. Thumbnails grow to 96px tall and open the full-screen viewer on tap.

**The Image Sets the Width Rule.** 이미지 트랙의 칸은 원본 비율을 그대로 따르며 잘라내지 않습니다(`object-fit: contain`). 썸네일만 예외로 `cover`를 허용합니다. / Track columns keep the original aspect ratio and are never cropped (`object-fit: contain`). Only thumbnails may use `cover`.

## Elevation & Depth

그림자가 없는 평면 시스템입니다. 깊이는 세 층의 면(Paper → Card → Recess)과 1px Hairline으로만 표현합니다. 유일하게 화면 위에 떠오르는 층은 전체 화면 뷰어로, 85% 검정 막(`rgb(0 0 0 / .85)`)이 앱 전체를 덮습니다.

A flat, shadowless system. Depth comes only from three tonal layers (Paper → Card → Recess) and the 1px Hairline. The one layer that floats above the app is the full-screen viewer, an 85% black scrim (`rgb(0 0 0 / .85)`) over everything.

**The Flat-By-Default Rule.** 카드, 칩, 패널에 `box-shadow`를 쓰지 않습니다. 구분이 더 필요하면 면의 단계를 바꾸거나 Hairline을 더합니다. / No `box-shadow` on cards, chips, or panels. If you need more separation, change the tonal layer or add a Hairline.

## Shapes

부드럽지만 둥글둥글하지 않은 모서리입니다. 크기가 클수록 반경도 커집니다. 세션 점 3px, 썸네일 5px, 아바타와 선택지 8px, 이미지 칸과 질문 카드 10px, 입력 자리 12px입니다. 칩 · 배지 · 버튼은 완전한 알약 모양(999px)으로, 「누를 수 있는 것」과 「담는 것」을 모양으로 구분합니다.

Soft but never bubbly corners, scaling with size: 3px session dots, 5px thumbnails, 8px avatars and options, 10px image columns and question cards, 12px input area. Chips, badges, and buttons are full pills (999px), so shape alone separates "things you press" from "things that hold."

심볼의 열린 대괄호 프레임은 모서리가 각진 선(512 기준 stroke 40–44)이고, 가운데 점은 원입니다. 앱 아이콘은 Signal Yellow 바탕에 Graphite Ink 심볼, 512 기준 112px 반경의 둥근 사각입니다.

The symbol's open bracket frame is a square-cornered stroke (40–44 on a 512 grid) around a round dot. The app icon is a Graphite Ink symbol on Signal Yellow, a rounded square with a 112px radius on a 512 grid.

## Components

### Observe badge

화면이 「구경 중」임을 알리는 유일한 노랑 라벨입니다. / The only yellow label, announcing that the screen is "watching."

- **Style:** Signal Yellow 면, Graphite Ink 글자, 12px 700, 알약(3px 9px) · Signal Yellow fill, Graphite Ink text, 12px 700, pill (3px 9px).
- **Placement:** 콘텐츠 헤더의 워드마크 바로 옆에 하나만 · Exactly one, right next to the wordmark in the content header.

### Buttons

- **Pill button:** 「새 이미지 n →」처럼 드물게 등장하는 행동. Graphite Ink 면에 Paper 글자를 반전시킨 알약(5px 12px, 12px) · Rare actions like "new images n →": an inverted pill, Paper text on Graphite Ink (5px 12px, 12px).
- **No primary CTA:** 큰 기본 버튼은 없습니다. gollabara가 사용자에게 먼저 행동을 요구하는 일이 없기 때문입니다. / There is no big primary button, because gollabara never asks you to act first.

### Chips

- **Filter chip:** 세션 필터. 기본은 Card 면 + Hairline 테두리, 선택되면 Graphite Ink 면으로 반전(4px 9px, 12px). 칩 줄은 가로로 스크롤하며 스크롤바를 숨깁니다. / Session filter. Card fill with a Hairline border by default, inverted to Graphite Ink when selected (4px 9px, 12px). The row scrolls sideways with the scrollbar hidden.
- **Question option:** 세션이 물은 질문의 선택지. Card 면 + Hairline 테두리, 8px 모서리. 버튼이 아닌 정적 라벨이며 hover 반응이 없습니다. / An option from a session's question. Card fill, Hairline border, 8px corners. A static label, not a button, with no hover response.

### Cards / Containers

- **Image column:** Card 면 위의 이미지, 10px 모서리, 1px Hairline. 위에 세션 점 · 이름 · 모노 메타(시각 · 크기)를 한 줄로 둡니다. 선택되면 3px Signal Yellow 윤곽선(offset 2px)을 두르고 세션 이름이 Signal Ink로 바뀝니다. / An image on Card, 10px corners, 1px Hairline, topped by one line of session dot, name, and mono meta (time, size). When selected it gets a 3px Signal Yellow outline (2px offset) and the session name turns Signal Ink.
- **Question card:** Recess Gray 면, 1px Hairline, 10px 모서리, 10px 12px 패딩. 맨 위에 Signal Ink 11px로 「세션이 물은 질문」이라고 출처를 밝힙니다. / Recess Gray fill, 1px Hairline, 10px corners, 10px 12px padding, headed by an 11px Signal Ink label saying the session asked it.
- **Stream message:** 30px 세션 아바타(세션 색 사각, 흰 이니셜) + 발신자 이름 · 시각 · 종류(「턴 끝」, 「이미지 n」) + 본문. 썸네일은 48px 높이로 원본 비율을 유지합니다. / A 30px session avatar (session-hue square with white initials), then sender name, time, and kind ("turn end," "images n"), then the body. Thumbnails are 48px tall and keep their ratio.

### Status indicators

- **Live dot:** 7px Live Green 원 + 「최신을 따라가는 중」 12px · A 7px Live Green dot with a 12px "following latest" label.
- **Connection dot:** 채팅 헤더의 7px 원. 연결되면 Live Green, 다시 연결하는 중이면 Slate Muted · A 7px dot in the chat header: Live Green when connected, Slate Muted while reconnecting.

### Viewer

이미지를 더블클릭(모바일은 탭)하면 85% 검정 막 위에 원본을 화면에 맞춰 띄웁니다. 막 어디를 눌러도 닫힙니다. 모바일에서는 핀치 줌을 허용합니다.

Double-click an image (tap on mobile) to show the original, fitted to the screen, over an 85% black scrim. Clicking anywhere on the scrim closes it. Pinch zoom works on mobile.

## Do's and Don'ts

### Do:

- **Do** 노랑은 「구경 중」 배지와 현재 선택에만 면 · 윤곽선으로 씁니다. / Use yellow only as a fill or outline, for the "watching" badge and the current selection.
- **Do** 밝은 화면에서 노랑 계열 글자가 필요하면 Signal Ink(`#7A6200`)를 씁니다. / Use Signal Ink (`#7A6200`) when a light screen needs yellow-family text.
- **Do** 시각 · 크기 · 개수는 IBM Plex Mono로 씁니다. / Set times, sizes, and counts in IBM Plex Mono.
- **Do** 이미지 칸의 너비는 원본 비율에 맡기고 잘라내지 않습니다. / Let the original ratio set image column width, uncropped.
- **Do** 새 색을 더하기 전에 면의 단계(Paper · Card · Recess)와 Hairline으로 해결할 수 있는지 먼저 봅니다. / Before adding a color, try the tonal layers (Paper, Card, Recess) and the Hairline.
- **Do** 새 토큰은 `web/src/style.css`의 라이트와 다크 양쪽에 함께 정의합니다. / Define new tokens for both light and dark in `web/src/style.css`.

### Don't:

- **Don't** 왼쪽 테두리에 강조색 띠를 두른 카드를 쓰지 않습니다. / Don't use cards with an accent stripe on the left border.
- **Don't** 숫자에 세리프 서체를 쓰지 않습니다. / Don't set numbers in a serif.
- **Don't** 카드 · 칩 · 패널에 그림자를 쓰지 않습니다. / Don't put shadows on cards, chips, or panels.
- **Don't** 세션의 질문 선택지를 누를 수 있는 버튼처럼 그리지 않습니다. 비추기만 합니다. / Don't draw a session's question options as pressable buttons; they are only mirrored.
- **Don't** 사용자에게 승인이나 결정을 재촉하는 모달 · 경고색 · 큰 기본 버튼을 만들지 않습니다. / Don't build modals, alarm colors, or big primary buttons that push the user to approve or decide.
- **Don't** 서비스명을 한글로 표기하지 않습니다. / Don't write the service name in Korean.
