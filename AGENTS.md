# AGENTS.md

이 저장소에서 일하는 에이전트(와 사람)를 위한 안내입니다. 제품의 불변 조건, 코드 구조, 명령, 규칙을 담습니다. 제품이 왜 이렇게 생겼는지는 [README.md](README.md), 화면 규칙은 [DESIGN.md](DESIGN.md)를 먼저 읽으세요.

A guide for agents (and people) working in this repository: product invariants, code layout, commands, and conventions. Read [README.md](README.md) for why the product looks the way it does and [DESIGN.md](DESIGN.md) for the visual rules.

## 깨면 안 되는 것 · Invariants

1. **관찰자이지 중재자가 아니다.** 세션에게 승인을 요구하거나 질문을 새로 만드는 기능을 넣지 않습니다. 세션이 원래 하던 질문(`AskUserQuestion`)만 비춥니다. 에이전트가 무엇을 보낼지 판단하는 전용 `post` · `ask` 도구도 두지 않습니다.
   **Observer, not mediator.** Never add features that ask a session for approval or invent questions. Mirror only the session's own questions. No dedicated `post` / `ask` tools for agents to decide what to send.
2. **hook은 세션을 절대 막지 않는다.** 1.5초 타임아웃, 모든 오류 삼킴, 항상 exit 0. 서버가 꺼져 있으면 조용히 끝납니다.
   **The hook never blocks a session.** 1.5 s timeout, swallow every error, always exit 0. If the server is down, exit quietly.
3. **산출물만 흐른다.** 세션 대화 전체를 미러링하지 않습니다. 단위는 이미지 · 한 줄 리캡 · 질문입니다.
   **Only artifacts flow.** Never mirror full transcripts. The units are images, one-line recaps, and questions.
4. **렌더링하거나 판정하지 않는다.** 서버와 화면은 받은 이미지를 그대로 보여 줍니다. HTML 아티팩트 실행, 서버 측 스크린샷, diff 계산을 하지 않습니다.
   **No rendering, no judging.** Show received images as-is. No running HTML artifacts, server-side screenshots, or diffing.
5. **내 기기에만.** 데이터는 로컬 SQLite와 이미지 파일에만 둡니다. 서드파티 스토리지나 공개 인터넷 노출을 넣지 않습니다.
   **Local only.** Data lives in local SQLite and image files. No third-party storage, no public exposure.
6. **여러 하네스가 대상이다.** 지금은 Claude Code 플러그인만 있지만 Codex · Open Design · Claude Design도 대상입니다. `src/shared/types.ts`의 이벤트 타입을 Claude Code 전용 개념에 묶지 마세요.
   **Multi-harness by design.** Only the Claude Code plugin exists today, but Codex, Open Design, and Claude Design are targets. Keep the event types in `src/shared/types.ts` free of Claude-Code-only concepts.

## 구조 · Layout

| 경로 · Path         | 역할 · Role                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `src/cli.ts`        | `golla` CLI 진입점 (`serve`, `hook`) · CLI entry point                                            |
| `src/hook/`         | hook 입력 → 스트림 이벤트. `map.ts`는 순수 함수, I/O는 `index.ts` · Hook input → stream events    |
| `src/server/`       | `golla serve`: SQLite · 해시 이름 이미지 저장, WebSocket 송출 · Storage and WebSocket fan-out     |
| `src/shared/`       | 서버 · hook · 화면이 함께 쓰는 타입과 설정 · Shared types and config                              |
| `web/`              | Vue 3 + Vite 화면 · Viewer UI                                                                     |
| `plugin/`           | Claude Code 플러그인. `bin/hook.js`는 빌드 산출물이지만 커밋합니다 · Plugin; `bin/hook.js` is a committed build output |
| `docs/`             | 구조도 SVG (Open Design `gollabara-architecture` 프로젝트 출처) · Architecture diagrams            |
| `spike/`            | 초기 hook 입력 포착 실험. 참고용 · Early capture experiments, reference only                      |

## 명령 · Commands

[bun](https://bun.sh) 1.3 이상만 씁니다. npm · pnpm · yarn을 쓰지 마세요. / Use bun 1.3+ only; never npm, pnpm, or yarn.

```bash
bun install
bun run build        # hook 번들 + 화면 빌드 · bundle hook + build web
bun run dev          # 서버, 파일 변경 시 재시작 · server with restart on change
bun run dev:web      # 화면 개발 서버 (4748 → 4747 프록시) · web dev server
bun test             # hook 매핑 테스트 · hook mapping tests
bun run typecheck
```

`src/hook/` 또는 `src/shared/`를 고치면 `bun run build:hook`으로 `plugin/bin/hook.js`를 다시 만들고 함께 커밋합니다. 플러그인은 캐시로 복사되어 이 파일만으로 돌아갑니다.

After editing `src/hook/` or `src/shared/`, rebuild `plugin/bin/hook.js` with `bun run build:hook` and commit it. The plugin is copied into a cache and runs from this file alone.

## 설정 · Configuration

| 환경 변수 · Variable | 기본값 · Default        | 설명 · Description                                                    |
| -------------------- | ----------------------- | --------------------------------------------------------------------- |
| `GOLLABARA_PORT`     | `4747`                  | 서버 포트 · Server port                                               |
| `GOLLABARA_URL`      | `http://127.0.0.1:4747` | hook이 이벤트를 보낼 서버 주소 · Server the hook posts events to      |
| `GOLLABARA_DATA`     | `~/.gollabara/data`     | 메시지 DB와 이미지 저장 위치 · Where messages and images are stored  |

## 포착 · Capture (Claude Code)

| hook                             | 스트림에 올라가는 것 · What lands in the stream                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `SessionStart`                   | 이벤트는 보내지만 서버가 아직 저장하지 않음 · Sent, but the server ignores it for now         |
| `PostToolUse` (모든 도구)        | 도구 결과 속 이미지. MCP 결과(예: Open Design) 포함 · Images in tool results, MCP included     |
| `Stop`                           | 그 턴 마지막 답변의 첫 줄(리캡, 최대 160자) · First line of the turn's last reply (≤160 chars) |
| `PreToolUse` (`AskUserQuestion`) | 세션이 물은 질문과 선택지 · The session's own question and options                            |

세션 이름은 `<폴더>` 또는 `<폴더> · <브랜치>`(main · master 제외)입니다. / Session names are `<dir>` or `<dir> · <branch>` (except main/master).

## 규칙 · Conventions

- **화면 · UI:** [DESIGN.md](DESIGN.md)를 따릅니다. 토큰은 `web/src/style.css`에 라이트 · 다크를 함께 정의합니다. 디자인 출처는 Open Design의 `gollabara-brand` 프로젝트(방향 03 「구경 모드 · Quiet signal」)입니다. `gollabara-app` 프로젝트의 앱 시안은 아직 검토 중이며 채택 전이므로 코드에 옮기지 마세요. / Follow DESIGN.md; define tokens in `web/src/style.css` for both light and dark. The design source is the Open Design project `gollabara-brand` (direction 03). The app mockup in the `gollabara-app` project is still under review and not adopted; do not port it.
- **코드 주석 · Code comments:** 한국어로 짧게, 「왜」를 씁니다. / Short, in Korean, explaining why.
- **문서 · Docs:** README · DESIGN.md · AGENTS.md의 설명은 한국어와 영어를 함께 씁니다. README는 기술 서술보다 디자인 철학을 담습니다. / Write descriptions in both Korean and English. The README carries the design philosophy, not technical detail.
- **커밋 · Commits:** Conventional Commits, 설명은 한국어 (`feat(web): …`, `fix(hook): …`). / Conventional Commits with Korean descriptions.
