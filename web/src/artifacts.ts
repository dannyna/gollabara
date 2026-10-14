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
  /** First visible artifact of a run from one session, or of a new day (draws the divider) */
  sessionStart: boolean
  /** First visible artifact of a new local day after an earlier one (dates its meta) */
  dayStart?: boolean
  /** Position among every received image, 1-based. Muting or scoping never renumbers it. */
  seq: number
  /** Position within its turn, 0-based */
  turnIndex?: number
  label?: string
}

export const artifactKey = (messageId: number, index: number) => `${messageId}-${index}`

/** Session names arrive as `<dir>` or `<dir> · <branch>` */
export function splitSessionName(name: string): { session: string, branch?: string } {
  const [session = name, ...rest] = name.split(' · ')
  return rest.length ? { session, branch: rest.join(' · ') } : { session }
}

const dayKey = (at: number) => new Date(at).toDateString()

/**
 * Every image across turns, in arrival order. `seq` counts all of `messages`; the result
 * holds only images from `shown` (the session scope minus muted sessions), and the
 * dividers are worked out between those visible neighbours.
 */
export function toArtifacts(messages: StreamMessage[], shown: StreamMessage[] = messages): Artifact[] {
  const images = messages.flatMap(m => (m.images ?? []).map((image, i) => ({ m, image, i })))
  // Turns from different sessions interleave, so order by each image's own arrival.
  // Images stored before turns existed have no `at`; they fall back to the message time.
  // Array#sort is stable, so ties keep message order.
  images.sort((a, b) => (a.image.at ?? a.m.at) - (b.image.at ?? b.m.at))
  const visible = new Set(shown.map(m => m.id))
  const out: Artifact[] = []
  images.forEach(({ m, image, i }, n) => {
    if (!visible.has(m.id))
      return
    const at = image.at ?? m.at
    const prev = out.at(-1)
    const dayStart = !!prev && dayKey(prev.at) !== dayKey(at)
    out.push({
      key: artifactKey(m.id, i),
      messageId: m.id,
      url: image.url,
      width: image.width,
      height: image.height,
      sessionId: m.sessionId,
      ...splitSessionName(m.sessionName),
      at,
      sessionStart: !prev || prev.sessionId !== m.sessionId || dayStart,
      dayStart,
      seq: n + 1,
      turnIndex: i,
      // MCP tool names read better without their server prefix
      label: m.toolName?.split('__').at(-1),
    })
  })
  return out
}

/** Caption text: the image's name, or its place in the turn (names are rare in real data) */
export function artifactCaption(a: Artifact): string {
  return a.label ?? `${(a.turnIndex ?? 0) + 1}장째`
}

/** `10.14`, put before the time on the first cell of a new day */
export function day(at: number) {
  const d = new Date(at)
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export const clock = (at: number) => new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
