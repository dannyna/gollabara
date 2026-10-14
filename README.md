# Gollabara (골라바라)

> 골라 골라, 구경은 공짜

여러 Claude Code 세션이 만든 결과물(스크린샷 · 생성 이미지 · 턴 끝 리캡 · 세션이 원래 하던 질문)을 hook으로 포착해 하나의 스트림으로 흘려보내는 로컬 서버와 웹 화면이다. Gollabara는 관찰자다. 세션에게 승인을 요구하거나 질문을 만들지 않는다.

## 실행

```bash
bun install
bun run build:web
bun src/cli.ts serve
```

브라우저에서 <http://localhost:4747>을 연다. 화면을 고치는 동안에는 `bun run dev:web`(4748 포트, 서버로 프록시)을 쓴다.

## 세션 연결

결과물을 흘려보낼 Claude Code 세션을 플러그인과 함께 연다.

```bash
claude --plugin-dir ~/IdeaProjects/gollabara/plugin
```

다른 컴퓨터의 세션은 `GOLLABARA_URL`을 서버 주소로 지정한다.

| 환경 변수         | 기본값                   | 설명                   |
| ----------------- | ------------------------ | ---------------------- |
| `GOLLABARA_PORT`  | `4747`                   | 서버 포트              |
| `GOLLABARA_URL`   | `http://127.0.0.1:4747`  | hook이 보낼 서버 주소  |
| `GOLLABARA_DATA`  | `~/.gollabara/data`      | 메시지 DB와 이미지 저장 위치 |

## 포착하는 것

| hook                         | 스트림에 올라가는 것                         |
| ---------------------------- | -------------------------------------------- |
| `PostToolUse` (모든 도구)    | 도구 결과에 들어 있는 이미지                 |
| `Stop`                       | 그 턴 마지막 답변의 첫 줄 (리캡)             |
| `PreToolUse` (`AskUserQuestion`) | 세션이 물은 질문과 선택지 (미러링만)     |

hook은 1.5초 안에 끝나고 모든 오류를 삼킨다. 서버가 꺼져 있어도 세션은 멈추지 않는다.

## 문서

- 요구사항: `~/IdeaProjects/ideation/docs/brainstorms/2026-10-14-agent-control-inbox-requirements.md`
- 스파이크: `spike/` — hook 입력을 파일로 남기는 플러그인과 Open Design 브랜딩 실행 기록
