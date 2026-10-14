// Maps stream messages to what the shell draws. The only place that reads the
// message shape for the stream surface, so changes to StreamMessage land here.

import type { StreamMessage } from '../../src/shared/types'

export interface Artifact {
  key: string
  messageId: number
  url: string
  width: number
  height: number
  sessionId: string
  session: string
  branch?: string
  at: number
  /** First artifact of a run from one session (draws the divider) */
  sessionStart: boolean
  /** Position in the stream, 1-based */
  seq: number
  label?: string
}

export const artifactKey = (messageId: number, index: number) => `${messageId}-${index}`

/** Session names arrive as `<dir>` or `<dir> · <branch>` */
export function splitSessionName(name: string): { session: string, branch?: string } {
  const [session = name, ...rest] = name.split(' · ')
  return rest.length ? { session, branch: rest.join(' · ') } : { session }
}

/** Every image across turns, in arrival order */
export function toArtifacts(messages: StreamMessage[]): Artifact[] {
  const images = messages.flatMap(m => (m.images ?? []).map((image, i) => ({ m, image, i })))
  // Turns from different sessions interleave, so order by each image's own arrival.
  // Images stored before turns existed have no `at`; they fall back to the message time.
  // Array#sort is stable, so ties keep message order.
  images.sort((a, b) => (a.image.at ?? a.m.at) - (b.image.at ?? b.m.at))
  return images.map(({ m, image, i }, n) => ({
    key: artifactKey(m.id, i),
    messageId: m.id,
    url: image.url,
    width: image.width,
    height: image.height,
    sessionId: m.sessionId,
    ...splitSessionName(m.sessionName),
    at: image.at ?? m.at,
    sessionStart: n === 0 || images[n - 1]!.m.sessionId !== m.sessionId,
    seq: n + 1,
    // MCP tool names read better without their server prefix
    label: m.toolName?.split('__').at(-1),
  }))
}

export const clock = (at: number) => new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
