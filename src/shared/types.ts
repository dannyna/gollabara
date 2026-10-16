// Stream types shared by the server, the hook, and the UI

/** Tool a session runs in. Events from older hooks that omit it are treated as claude-code. */
export type Harness = 'claude-code' | 'open-design' | 'codex' | 'claude-design'

/** Event the hook sends to the server */
export type IncomingEvent
  // `pid`: the harness process the session runs in, so a wake-up waiter can tell when it moved to another session
  = | { kind: 'session', session: SessionInfo, pid?: number, reason?: SessionStartReason }
    | { kind: 'image', session: SessionInfo, toolName: string, images: IncomingImage[] }
    // `continuation`: the turn went on after another stop hook, so this recap joins the previous turn
    | { kind: 'recap', session: SessionInfo, text: string, continuation?: boolean }
    // `id`: the harness's call id for the question (Claude Code's and Codex's tool_use_id), when it sends one
    | { kind: 'question', session: SessionInfo, questions: Question[], id?: string }
    // The user answered the session's question (in its terminal or in the app); `answers` is keyed by question text
    | { kind: 'answer', session: SessionInfo, questionId: string, answers: Record<string, string> }
    // The session closed (the user quit, or its conversation was cleared): feedback to it is refused until it comes back
    | { kind: 'session-end', session: SessionInfo }

/**
 * Why a session (re)started: a fresh launch, a resumed or cleared conversation, or a context
 * compaction, which can happen mid-turn and changes nothing about the running turn
 */
export type SessionStartReason = 'startup' | 'resume' | 'clear' | 'compact'

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
  /**
   * When the session ended: a session-end event, or its harness process went away. Any later event from
   * it (a resume) clears it. Feedback to an ended session is refused.
   */
  endedAt?: number
  /** A wake-up Stop hook is waiting on the session's feedback, so it reaches the session at once, even when idle */
  channel?: boolean
  /** How feedback can reach the session right now (`routesFor`); missing on records from older servers */
  routes?: DeliveryRoute[]
  /** What it is doing now, as far as the server saw; missing on an ended session and from older servers */
  state?: SessionState
}

/**
 * Mid-turn, mid-turn waiting on the user's answer to its own question, or between turns. Kept in the
 * server's memory, so every session reads idle after a restart until it does something.
 */
export type SessionState = 'working' | 'waiting' | 'idle'

/**
 * A way feedback reaches a session, whatever the harness calls its hook points: next to the next tool
 * result, alongside the next prompt, when the session tries to end its turn, or by waking an idle session
 */
export type DeliveryRoute = 'next-tool' | 'next-prompt' | 'turn-end' | 'idle-wake'

export interface IncomingImage {
  /** base64 (no data URL prefix) */
  data: string
  mime: string
  width?: number
  height?: number
  /** Where the image came from when the tool names it, e.g. the file path a session read. Full path; the UI shows the basename. */
  source?: string
  role?: ImageRole
}

/**
 * What an image is to the session: something it made (`artifact`), or something it only looked
 * at to decide what to do (`reference`: a mock, an existing asset, an older screenshot). The
 * harness decides deterministically; images without a role count as artifacts.
 */
export type ImageRole = 'artifact' | 'reference'

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
  /** The harness's call id for a question, which its answer and a hold name it by; missing on older rows and from hooks that send none */
  questionId?: string
  /** How the question was answered, once it was; the first answer recorded wins */
  answer?: QuestionAnswer
}

/** Answers to a question message, keyed by question text; multiSelect labels are joined with ", " */
export interface QuestionAnswer {
  answers: Record<string, string>
  /** Answered in the session's own terminal, or from the app while its `ask` hook held the question */
  via: 'terminal' | 'app'
  at: number
}

/** A question the session's `ask` hook holds open, so the app can answer it until `until` */
export interface QuestionHold {
  sessionId: string
  questionId: string
  until: number
}

/** POST /api/questions/answer: answers to a held question, keyed by question text */
export interface AnswerRequest {
  sessionId: string
  questionId: string
  answers: Record<string, string>
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
  /** Missing on rows stored before roles existed; those count as artifacts */
  role?: ImageRole
}

/**
 * When a session picked up feedback: after a tool call, when it tried to end its turn,
 * alongside the next prompt, or by a waiting hook that woke the idle session. `channel` came from the
 * channel server, since removed, and appears only on older rows.
 * Harnesses map their own hook points onto these.
 */
export type FeedbackVia = 'post-tool-use' | 'stop' | 'user-prompt-submit' | 'channel' | 'rewake'

/** Body of POST /api/feedback. The user writes it; gollabara only carries it. */
export interface FeedbackRequest {
  sessionId: string
  text: string
  /** A stored image the feedback is about: its /img/<name> url or bare file name */
  image?: string
  /** The session's chat message the feedback replies to */
  quote?: FeedbackQuote
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

/** A session's chat message the user replied to: its recap line (one line, at most 300 chars) and when it was posted */
export interface FeedbackQuote {
  text: string
  at: number
}

export interface Feedback {
  id: number
  sessionId: string
  text: string
  image?: FeedbackImage
  quote?: FeedbackQuote
  createdAt: number
  /** Unset while queued */
  deliveredAt?: number
  deliveredVia?: FeedbackVia
}

/** CLI the server runs to triage chat text. Off unless the user opts in. */
export type TriageEngine = 'off' | 'claude' | 'codex'

/**
 * Settings stored on the server (GET/PUT /api/settings), so every device agrees. Only theme and the
 * server address stay in each browser. A key never saved is absent, so the first client can seed it.
 */
export interface ServerSettings {
  triage: TriageEngine
  /** Address to open on a phone; https only, empty when unset */
  phone?: string
  /** 「앱에서 답하기」: whether a session's question may be held for the app to answer; absent reads as off */
  answer?: AnswerSetting
}

export type AnswerSetting = 'on' | 'off'

/** PUT /api/settings: any subset of the settings. `seed` writes only keys the server has no value for. */
export type SettingsPatch = Partial<ServerSettings> & { seed?: boolean }

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

/** A device's Web Push subscription (PushSubscription.toJSON()), the body of POST /api/push/subscribe */
export interface PushSubscriptionKeys {
  /** The browser vendor's push service URL for this device */
  endpoint: string
  /** base64url keys the payload is encrypted to (RFC 8291) */
  keys: { p256dh: string, auth: string }
}

/**
 * The whole payload of a push: which fixed copy the device shows, a question (`q`) or an answer
 * to the user's feedback (`r`). It never carries session text, a name or an image (invariant 5).
 */
export interface PushPayload {
  t: 'q' | 'r'
}

/**
 * `GET /api/history`: a run of messages with no gap, oldest first, with the verdicts on them and the
 * feedback sent in the time they span. `older` says whether more messages lie before it.
 */
export interface HistoryPage {
  messages: StreamMessage[]
  triage: Triage[]
  feedback: Feedback[]
  older: boolean
}

/** Frame sent to the UI over WebSocket */
export type ServerFrame
  // `older`: messages exist before the first one sent (missing from servers before #77)
  // `holds`: questions the app can answer right now; `now`: the server's clock their `until` reads
  = | { type: 'hello', messages: StreamMessage[], sessions: Session[], feedback: Feedback[], triage?: Triage[], settings?: ServerSettings, older?: boolean, holds?: QuestionHold[], now?: number }
    | { type: 'message', message: StreamMessage }
    // An existing message changed in place: same id, new content
    | { type: 'message-upsert', message: StreamMessage }
    | { type: 'session', session: Session }
    // Same id moves from queued to delivered
    | { type: 'feedback', status: 'queued' | 'delivered', feedback: Feedback }
    | { type: 'triage', triage: Triage }
    | { type: 'settings', settings: ServerSettings }
    // A hold started (`until` is when it ends) or ended (`until: null`: answered, expired, or the hook went away).
    // `now` is the server's clock when it was sent, so a view whose clock is off counts down the time left
    | { type: 'hold', sessionId: string, questionId: string, until: number | null, now?: number }
    // Rows expiry or 「이 세션 데이터 삭제」 removed; views drop them
    | { type: 'deleted', messageIds: number[], feedbackIds: number[], sessionIds: string[] }

/** The latest hook seen from one harness; `version` is null for a hook from before the version handshake */
export interface HookSeen {
  harness: Harness
  version: string | null
  seenAt: number
  /** Older than the plugin version the server expects, or sent no version */
  outdated: boolean
}

/** `GET /api/health`: what the server expects and which hooks it has heard from */
export interface Health {
  /** Plugin version the server expects hooks to run */
  version: string
  /** SQLite schema version */
  schema: number
  hooks: HookSeen[]
}
