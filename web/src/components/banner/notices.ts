// Which notice each area shows (OD banner-components.html, 08 공통 규칙).
// One notice per area; when two compete, the higher one in the guide's table wins.
// Notices only reflect what the stream and the server report.

/** App-bar chip: nothing while connected, 「다시 연결 중」, or 「다시 연결됐어요」 for 3 s */
export type ConnectionStatus = 'online' | 'offline' | 'restored'

export interface NoticeInput {
  /** The first-connection guide replaces the work surfaces */
  setup: boolean
  connection: ConnectionStatus
  /** The stream area shows a state view (nothing to show in this scope) */
  streamEmpty?: boolean
  /** The chat area shows a state view */
  chatEmpty?: boolean
  /** Artifacts that arrived while the reader browsed back */
  unseenArtifacts?: number
  /** Messages that arrived while the reader scrolled up */
  unseenMessages?: number
}

export interface Notices {
  chip: ConnectionStatus
  /** 「연결을 기다리는 중이에요. 이전 대화는 계속 볼 수 있어요.」 under the chat heading */
  chatNote: boolean
  streamPill: number
  chatPill: number
  /** What the composer note says: the usual hint, or why sending is blocked */
  composer: 'hint' | 'offline'
}

export function resolveNotices(input: NoticeInput): Notices {
  const offline = input.connection === 'offline'
  // 1. The setup guide silences every panel notice, and its first step already
  //    says whether the server answers, so the chip stays quiet too
  if (input.setup)
    return { chip: 'online', chatNote: false, streamPill: 0, chatPill: 0, composer: 'hint' }
  return {
    // 2–3. Connection: chip and note together; the note folds as soon as it is back
    chip: input.connection,
    chatNote: offline,
    // Nothing arrives while offline; a state view owns its whole area (4 over 5)
    streamPill: offline || input.streamEmpty ? 0 : input.unseenArtifacts ?? 0,
    chatPill: offline || input.chatEmpty ? 0 : input.unseenMessages ?? 0,
    // 6. A blocked reason replaces the usual hint in the same place
    composer: offline ? 'offline' : 'hint',
  }
}
