// Stream types shared by the server, the hook, and the UI

/** Tool a session runs in. Events from older hooks that omit it are treated as claude-code. */
export type Harness = 'claude-code' | 'open-design' | 'codex' | 'claude-design'

/** Event the hook sends to the server */
export type IncomingEvent
  = | { kind: 'session', session: SessionInfo }
    | { kind: 'image', session: SessionInfo, toolName: string, images: IncomingImage[] }
    // `continuation`: the turn went on after another stop hook, so this recap joins the previous turn
    | { kind: 'recap', session: SessionInfo, text: string, continuation?: boolean }
    | { kind: 'question', session: SessionInfo, questions: Question[] }

export interface SessionInfo {
  /** Session id from the harness, stable across resumes */
  id: string
  /** Sender name shown in the UI (e.g. piuda · desktop-shell) */
  name: string
  harness: Harness
  /** Harness-side project id (e.g. the Open Design project), when there is one */
  project?: string
  cwd: string
}

/** Session record the server keeps, one per session id */
export interface Session extends SessionInfo {
  /** First SessionStart, or the first event seen if the session started before the plugin was installed */
  startedAt: number
  lastSeenAt: number
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

/**
 * Message the server stores and streams to the UI.
 * A `turn` groups one session turn: its images in arrival order and the recaps that close it.
 * `image` and `recap` remain for messages stored before turns existed.
 */
export interface StreamMessage {
  id: number
  at: number
  sessionId: string
  sessionName: string
  kind: 'turn' | 'image' | 'recap' | 'question'
  /** Recaps joined by newlines, for views that show a single text */
  text?: string
  /** Turn recaps in order; a stop-hook continuation adds another */
  recaps?: string[]
  toolName?: string
  images?: StoredImage[]
  questions?: Question[]
}

export interface StoredImage {
  /** /img/<hash>.<ext> */
  url: string
  width: number
  height: number
  /** When the image arrived (missing on messages stored before turns existed) */
  at?: number
}

/** Frame sent to the UI over WebSocket */
export type ServerFrame
  = | { type: 'hello', messages: StreamMessage[], sessions: Session[] }
    | { type: 'message', message: StreamMessage }
    // An existing message changed in place: same id, new content
    | { type: 'message-upsert', message: StreamMessage }
    | { type: 'session', session: Session }
