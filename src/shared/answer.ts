// Answering a session's own question from the app (opt-in, Claude Code only): shared by the `ask` hook, the
// server that holds the question, and the UI that counts the hold down.

/**
 * How long the `ask` hook holds a question for the app. The terminal hides the question meanwhile, so the
 * hold is short; once it runs out the session's own dialog appears.
 */
export const ANSWER_HOLD_MS = 60_000

/** Longest answer the app may send for one question, in characters */
export const ANSWER_MAX = 2000
