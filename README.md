# gollabara

> 골라 골라, 구경은 공짜 — Step right up, looking is free.

Open Design · Claude Code · Codex · Claude Design 세션이 만들어 내는 **산출물**(스크린샷 · 시안 · 턴 끝 리캡 · 세션이 물은 질문)만 하나의 흐름으로 모아 보는 로컬 웹 앱입니다. 옆 모니터나 폰에 띄워 두고 구경하다가, 필요할 때만 끼어들면 됩니다.

A local web app that gathers only the **artifacts** your Open Design, Claude Code, Codex, and Claude Design sessions produce (screenshots, design mockups, end-of-turn recaps, and the questions sessions ask) into a single stream. Keep it on a side monitor or your phone, watch it flow, and step in only when you need to.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.svg">
  <img src="docs/architecture-light.svg" alt="gollabara 구조도: Claude Code · Open Design · Codex · Claude Design 세션의 산출물이 로컬 서버로 모이고, 서버는 내 기기에 저장한 뒤 데스크톱 웹과 폰에 흘린다. 점선은 예정된 포착과 개입(멈춤 · 답장 · @멘션)." width="100%">
</picture>

## 왜 만들었나 · Why

UX 엔지니어로 클라이언트를 개발하다 보면 스크린샷이나 시안을 보면서 결정하거나 피드백해야 할 때가 많습니다. 동시에 클라이언트 개발 세션을 돌리면서 그 흐름을 지켜보다가 개입해야 할 때도 있습니다. 이 일을 Open Design, Claude Code, Codex, Claude Design을 오가며 합니다. 필요한 것은 모든 세션을 통째로 한곳에 모으는 대시보드가 아니었습니다. **산출물을 중심으로 흐름을 관찰하는 화면**이었습니다.

As a UX engineer building client apps, I constantly make decisions and give feedback while looking at screenshots and mockups. At the same time, I run client development sessions and need to watch them and step in now and then. That work spans Open Design, Claude Code, Codex, and Claude Design. What I needed was not a dashboard that pulls every session into one place, but **a view that follows the flow through its artifacts**.

## 디자인 철학 · Design philosophy

### 세션이 아니라 산출물을 본다 · Watch the artifacts, not the sessions

관찰 대상을 세션에서 산출물로 줄입니다. 대화 전체를 미러링하지 않고, 세션별 탭이나 분할 화면도 두지 않습니다. 모든 도구의 산출물이 시간순으로 하나의 흐름에 섞여 흐르고, 세션은 발신자 이름으로만 구분됩니다.

We shrink what you watch from sessions to artifacts. No full-transcript mirroring, no per-session tabs or split panes. Artifacts from every tool flow together in one chronological stream, and a session is just a sender name.

### 관찰자이지 중재자가 아니다 · An observer, not a mediator

gollabara는 세션에게 승인을 요구하지 않고, 질문을 새로 만들지 않습니다. 세션의 워크플로가 원래 사용자에게 묻게 되어 있을 때만 그 질문을 비춥니다. 결정을 재촉하는 경고색이나 큰 버튼도 없습니다.

gollabara never asks a session for approval and never invents questions. It only mirrors a question when the session's own workflow was going to ask it anyway. No alarm colors, no big buttons pushing you to decide.

### 세션은 구경꾼을 의식하지 않는다 · Sessions don't know they're being watched

세션의 프롬프트나 워크플로를 이 앱을 위해 바꾸지 않습니다. 세션은 평소처럼 일하고, hook이 그 과정에서 나온 산출물을 집어 옵니다. 포착은 세션을 멈추거나 늦추지 않습니다. 서버가 꺼져 있으면 아무 일도 일어나지 않습니다.

You don't change a session's prompt or workflow for this app. Sessions work as usual, and hooks pick up what they produce along the way. Capturing never stops or slows a session; if the server is off, nothing happens at all.

### 판단은 사람의 눈으로 · Judgment stays with your eyes

화면이 맞는지는 모델이 아니라 사람이 봅니다. 그래서 gollabara는 무엇도 렌더링하거나 판정하지 않고, 세션이 찍은 스크린샷과 시안을 받은 그대로 보여 줍니다. 이미지가 주인공이므로 각 칸의 너비는 이미지의 원래 비율을 따르고, 잘라내지 않습니다.

Whether a screen is right is for a person to see, not a model. So gollabara renders and judges nothing; it shows the screenshots and mockups exactly as sessions captured them. The image is the star: every column takes the image's own aspect ratio, uncropped.

### 조용한 표면, 한 점의 신호 · A quiet surface, a single signal

하루 종일 옆에 켜 두는 화면이라 표면은 거의 흑백인 개발 도구처럼 조용합니다. 노랑은 「지금 구경 중」과 「내가 고른 것」, 두 곳에만 찍힙니다. 심볼인 열린 뷰파인더는 관찰을, 그 안의 한 점은 고르는 순간을 뜻합니다. 자세한 규칙은 [DESIGN.md](DESIGN.md)에 있습니다.

It lives beside you all day, so the surface stays quiet, a near-monochrome developer tool. Yellow appears in only two places: "watching now" and "what you picked." The symbol, an open viewfinder, stands for observing; the dot inside it is the moment you pick. The full rules live in [DESIGN.md](DESIGN.md).

### 두 방향의 흐름 · Two flows, two directions

데스크톱에서 이미지는 가로로, 리캡과 질문은 세로로 흐릅니다. 하나를 고르면 다른 쪽의 짝이 함께 밝아집니다. 폰에서는 채팅만 남기고, 이미지는 탭해서 크게 봅니다.

On the desktop, images flow sideways while recaps and questions flow down. Pick one and its counterpart lights up on the other side. On a phone only the chat remains, and you tap an image to see it full size.

### 내 기기에만 · Stays on your machine

산출물은 내 기기에만 저장되고, 서드파티 스토리지로 나가지 않습니다. 밖에서 볼 때도 Tailscale tailnet 안에서만 열도록 설계합니다. 공개 인터넷에는 노출하지 않습니다.

Artifacts are stored only on your machine and never leave for third-party storage. Remote viewing is designed to stay inside your Tailscale tailnet, never on the public internet.

## 이름 · The name

gollabara는 「골라 봐라」를 경상도 말투로 소리 나는 대로 적은 이름입니다. 장터 좌판의 「골라 골라!」처럼 물건이 쭉 흘러가고, 구경은 공짜이고, 마음에 드는 것만 집으면 됩니다.

gollabara spells out, as it sounds, the Gyeongsang-dialect way of saying "go ahead, take your pick," the call of a street-market vendor. Goods flow past, looking is free, and you pick only what catches your eye.

## 지금 상태 · Where it stands

초기 단계입니다. 지금은 관찰(이미지 · 리캡 · 질문이 흘러오기)까지 동작하며, Claude Code 세션과 그 안에서 부르는 Open Design의 산출물을 받습니다.

Early stage. Observation works today (images, recaps, and questions flowing in) for Claude Code sessions, including Open Design work called from inside them.

- [ ] 로그인 시 자동 실행과 폰 홈 화면 설치 · Launch at login and install to the phone home screen
- [ ] 개입: 멈춤 · 답장 · `@멘션` · 음소거 · Step in: pause, reply, `@mention`, mute
- [ ] 폰 원격 접속과 알림 · Remote phone access and notifications
- [ ] Codex · Open Design · Claude Design 세션에서 직접 받기 · Capture directly from Codex, Open Design, and Claude Design sessions

## 써 보기 · Try it

[bun](https://bun.sh) 1.3 이상이 필요합니다. / Requires [bun](https://bun.sh) 1.3 or later.

```bash
bun install && bun run build
bun src/cli.ts serve                       # http://localhost:4747
claude plugin marketplace add ./ && claude plugin install gollabara@gollabara
```

개발과 설정은 [AGENTS.md](AGENTS.md)를 보세요. / For development and configuration, see [AGENTS.md](AGENTS.md).

## License

MIT
