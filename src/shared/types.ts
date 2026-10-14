// 서버 · hook · 화면이 함께 쓰는 스트림 타입

/** hook 이 서버로 보내는 이벤트 */
export type IncomingEvent
  = | { kind: 'session', session: SessionInfo }
    | { kind: 'image', session: SessionInfo, toolName: string, images: IncomingImage[] }
    | { kind: 'recap', session: SessionInfo, text: string }
    | { kind: 'question', session: SessionInfo, questions: Question[] }

export interface SessionInfo {
  /** Claude Code session_id */
  id: string
  /** 화면에 보일 발신자 이름 (예: piuda · desktop-shell) */
  name: string
  cwd: string
}

export interface IncomingImage {
  /** base64 (data URL 접두사 없음) */
  data: string
  mime: string
  width?: number
  height?: number
}

export interface Question {
  question: string
  header?: string
  options: { label: string, description?: string }[]
  multiSelect?: boolean
}

/** 서버가 저장하고 화면으로 흘리는 메시지 */
export interface StreamMessage {
  id: number
  at: number
  sessionId: string
  sessionName: string
  kind: 'image' | 'recap' | 'question'
  text?: string
  toolName?: string
  images?: StoredImage[]
  questions?: Question[]
}

export interface StoredImage {
  /** /img/<hash>.<ext> */
  url: string
  width: number
  height: number
}

/** WebSocket 으로 화면에 보내는 프레임 */
export type ServerFrame
  = | { type: 'hello', messages: StreamMessage[] }
    | { type: 'message', message: StreamMessage }
