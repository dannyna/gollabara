// Stream types shared by the server, the hook, and the UI

/** Tool a session runs in. Events from older hooks that omit it are treated as claude-code. */
export type Harness = 'claude-code' | 'open-design' | 'codex' | 'claude-design'

/** Event the hook sends to the server */
export type IncomingEvent
  // `pid`: the harness process the session runs in, so a channel server it spawned can find the session
  = | { kind: 'session', session: SessionInfo, pid?: number }
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
  /** A channel server or a wake-up Stop hook is waiting on the session's feedback, so it reaches the session at once, even when idle */
  channel?: boolean
}

export interface IncomingImage {
  /** base64 (no data URL prefix) */
  data: string
  mime: string
  width?: number
  height?: number
  /** Where the image came from when the tool names it, e.g. the file path a session read. Full path; the UI shows the basename. */
  source?: string
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
  /** Full path or name the image came from, when known (see IncomingImage.source) */
  source?: string
  /**
   * 64-bit difference hash as 16 hex chars, stored only for images with a `source`.
   * Used only to group near-identical re-captures; never shown and never used to judge.
   */
  dhash?: string
}

/**
 * When a session picked up feedback: after a tool call, when it tried to end its turn,
 * alongside the next prompt, pushed through a channel, or by a waiting hook that woke the idle session.
 * Harnesses map their own hook points onto these.
 */
export type FeedbackVia = 'post-tool-use' | 'stop' | 'user-prompt-submit' | 'channel' | 'rewake'

/** Body of POST /api/feedback. The user writes it; gollabara only carries it. */
export interface FeedbackRequest {
  sessionId: string
  text: string
  /** A stored image the feedback is about: its /img/<name> url or bare file name */
  image?: string
}

/** Body of POST /api/feedback/claim, sent by the hook */
export interface FeedbackClaim {
  sessionId: string
  via: FeedbackVia
}

/** The stored image feedback points at, resolved so the session can open it */
export interface FeedbackImage {
  /** /img/<name> */
  url: string
  /** Absolute path of the stored file on the server machine */
  path: string
  /** When the image was captured */
  at: number
  /** Session that produced the image, when it is still in the stream */
  sessionName?: string
}

export interface Feedback {
  id: number
  sessionId: string
  text: string
  image?: FeedbackImage
  createdAt: number
  /** Unset while queued */
  deliveredAt?: number
  deliveredVia?: FeedbackVia
}

/** CLI the server runs to triage chat text. Off unless the user opts in. */
export type TriageEngine = 'off' | 'claude' | 'codex'

/** Server-side settings (GET/PUT /api/settings): the server, not the browser, runs what they control */
export interface ServerSettings {
  triage: TriageEngine
}

/** Whether a recap line is shown in the chat; hidden lines fold into 「숨긴 메시지 n」 rows */
export type Verdict = 'show' | 'hide'

/**
 * The state a shown line is drawn with: a result to check (success), something the user should
 * look at although nothing is stuck (warning), or a failure or blocker (danger)
 */
export type Tone = 'default' | 'success' | 'warning' | 'danger'

/** A model's reading of one recap line. Shown only to the user; nothing here is ever sent to a session. */
export interface Triage {
  messageId: number
  /** Recap index within the turn; 0 for a legacy recap message */
  index: number
  verdict: Verdict
  /** Only for shown lines; missing (as on verdicts stored before tones) reads as default */
  tone?: Tone
}

/** Frame sent to the UI over WebSocket */
export type ServerFrame
  = | { type: 'hello', messages: StreamMessage[], sessions: Session[], feedback: Feedback[], triage?: Triage[], settings?: ServerSettings }
    | { type: 'message', message: StreamMessage }
    // An existing message changed in place: same id, new content
    | { type: 'message-upsert', message: StreamMessage }
    | { type: 'session', session: Session }
    // Same id moves from queued to delivered
    | { type: 'feedback', status: 'queued' | 'delivered', feedback: Feedback }
    | { type: 'triage', triage: Triage }
    | { type: 'settings', settings: ServerSettings }
