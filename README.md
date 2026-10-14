# gollabara (골라바라)

> 골라 골라, 구경은 공짜

Claude Code 세션을 여러 개 동시에 돌릴 때, 각 세션이 만든 **결과물만** 하나의 스트림으로 모아 보는 로컬 웹 앱입니다. 스크린샷, 생성 이미지, 턴이 끝날 때의 한 줄 리캡, 세션이 원래 하려던 질문이 흘러옵니다. 옆 모니터나 폰에 띄워 두고 구경하다가, 필요할 때만 끼어들면 됩니다.

gollabara는 **관찰자이지 중재자가 아닙니다.** 세션에게 승인을 요구하거나 질문을 새로 만들지 않습니다. 세션은 평소처럼 일하고, Claude Code hook이 그 과정에서 나온 결과물을 포착해 보냅니다.

「골라바라」는 「골라 봐라」를 경상도 말투로 쓴 이름입니다. 장터 좌판의 「골라 골라!」처럼 물건이 쭉 흘러가고, 구경은 공짜이고, 마음에 드는 것만 집으면 됩니다.

## 동작 방식

```text
Claude Code 세션들 ──(hook: 스크린샷 · 리캡 · 질문)──▶ golla serve ──▶ 데스크톱 · 폰 화면
```

- **데스크톱:** 이미지는 가로로 흐르고, 칸 너비는 이미지 비율을 따릅니다. 채팅(리캡 · 질문)은 세로로 흐릅니다.
- **폰:** 채팅만 보이고, 이미지를 탭하면 전체 화면으로 봅니다.
- **저장:** 모든 데이터는 내 기기에만 저장됩니다(SQLite와 이미지 파일). 외부 접속은 Tailscale tailnet 안에서만 하도록 설계했습니다.

## 시작하기

[bun](https://bun.sh) 1.3 이상이 필요합니다.

```bash
git clone https://github.com/dannyna/gollabara.git
cd gollabara
bun install
bun run build
bun src/cli.ts serve
```

브라우저에서 <http://localhost:4747>을 엽니다.

### Claude Code 플러그인 설치

플러그인을 한 번 설치하면 이후 여는 모든 세션의 결과물이 흘러옵니다. 서버가 꺼져 있으면 hook은 아무것도 하지 않고 바로 끝납니다.

```bash
claude plugin marketplace add ./
claude plugin install gollabara@gollabara
```

다른 컴퓨터의 세션은 `GOLLABARA_URL` 환경 변수에 서버 주소를 지정합니다.

| 환경 변수        | 기본값                  | 설명                         |
| ---------------- | ----------------------- | ---------------------------- |
| `GOLLABARA_PORT` | `4747`                  | 서버 포트                    |
| `GOLLABARA_URL`  | `http://127.0.0.1:4747` | hook이 이벤트를 보낼 서버 주소 |
| `GOLLABARA_DATA` | `~/.gollabara/data`     | 메시지 DB와 이미지 저장 위치  |

## 포착하는 것

| hook                              | 스트림에 올라가는 것                    |
| --------------------------------- | --------------------------------------- |
| `PostToolUse` (모든 도구)         | 도구 결과에 들어 있는 이미지            |
| `Stop`                            | 그 턴 마지막 답변의 첫 줄 (리캡)        |
| `PreToolUse` (`AskUserQuestion`)  | 세션이 물은 질문과 선택지 (비추기만 함) |

hook은 1.5초 안에 끝나고 모든 오류를 무시합니다. gollabara 때문에 세션이 멈추는 일은 없습니다.

## 개발

```bash
bun run dev        # 서버 (파일 변경 시 재시작)
bun run dev:web    # 화면 개발 서버 (4748 → 4747 프록시)
bun test           # hook 매핑 테스트
bun run typecheck
```

## 상태

초기 단계입니다. 지금은 관찰(이미지 · 리캡 · 질문 흐르기)까지 동작합니다. 다음 순서로 진행할 예정입니다.

- [ ] 로그인 시 자동 실행 (macOS launchd)과 PWA 설치
- [ ] 개입: 세션 멈춤, 답장, `@멘션`, 음소거
- [ ] 폰: Tailscale 접속, 푸시 알림

## License

MIT
