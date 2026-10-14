// Stream types shared by the server, the hook, and the UI

/** Event the hook sends to the server */
export type IncomingEvent
  = | { kind: 'session', session: SessionInfo }
    | { kind: 'image', session: SessionInfo, toolName: string, images: IncomingImage[] }
    | { kind: 'recap', session: SessionInfo, text: string }
    | { kind: 'question', session: SessionInfo, questions: Question[] }

export interface SessionInfo {
  /** Claude Code session_id */
  id: string
  /** Sender name shown in the UI (e.g. piuda · desktop-shell) */
  name: string
  cwd: string
}

export interface IncomingImage {
  /** base64 (no data URL prefix) */
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

/** Message the server stores and streams to the UI */
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

/** Frame sent to the UI over WebSocket */
export type ServerFrame
  = | { type: 'hello', messages: StreamMessage[] }
    | { type: 'message', message: StreamMessage }
