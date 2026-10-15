// Maps stream messages to what the shell draws. The only place that reads the
// message shape for the stream surface, so changes to StreamMessage land here.

import type { ImageRole, StoredImage, StreamMessage } from '../../src/shared/types'
import { basename, stackCaptures } from '../../src/shared/stacks'

/** Consecutive cells from one session this close in time form one run: one title line, tighter gaps */
export const RUN_GAP_MS = 5 * 60 * 1000

/** One capture of a cell that hides earlier captures of the same screen */
export interface ArtifactVersion {
  /** artifactKey of this capture */
  key: string
  messageId: number
  url: string
  width: number
  height: number
  at: number
  source?: string
  /** Position within its turn, 0-based */
  turnIndex: number
}

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
  /** Full path the newest capture came from, when the tool named it */
  source?: string
  /**
   * First visible cell of a run: another session before it, a new day, or more than
   * RUN_GAP_MS since the cell before. Draws the divider and the session title line.
   */
  runStart: boolean
  /** First visible artifact of a new local day after an earlier one (dates its meta) */
  dayStart?: boolean
  /**
   * Cell number, 1-based, among every cell of every session, so muting or scoping never
   * renumbers it. Hidden duplicates take no number; a new capture of a screen moves its
   * cell to the end, and the cells after its old place close up.
   */
  seq: number
  /** Arrival order of the newest capture among every image received. Only grows; the new-artifact count reads it. */
  arrival: number
  /** Every capture of this screen, oldest → newest, when earlier ones are hidden (2 or more) */
  versions?: ArtifactVersion[]
  /** Position within its turn, 0-based */
  turnIndex?: number
  label?: string
  /** Set on images the session only looked at (toArtifacts with 'reference') */
  role?: 'reference'
}

export const artifactKey = (messageId: number, index: number) => `${messageId}-${index}`

/** Session names arrive as `<dir>` or `<dir> · <branch>` */
export function splitSessionName(name: string): { session: string, branch?: string } {
  const [session = name, ...rest] = name.split(' · ')
  return rest.length ? { session, branch: rest.join(' · ') } : { session }
}

const dayKey = (at: number) => new Date(at).toDateString()

/** Rows stored before roles existed have none; they count as artifacts */
export const roleOf = (image: Pick<StoredImage, 'role'>): ImageRole => image.role ?? 'artifact'

/**
 * One cell per screen across turns, in arrival order of each screen's newest capture.
 * Earlier captures of the same screen (src/shared/stacks.ts) are hidden behind it as
 * `versions`, except those the reader split off. `seq` counts all of `messages`; the
 * result holds only cells from `shown` (the session scope minus muted sessions), and the
 * runs are worked out between those visible neighbours.
 *
 * Only images of `role` count: artifacts by default, so references never take a number, an
 * arrival, or a place in an artifact's stack. `'reference'` lists the references the same way,
 * stacked only among themselves.
 */
export function toArtifacts(messages: StreamMessage[], shown: StreamMessage[] = messages, split: ReadonlySet<string> = new Set(), role: ImageRole = 'artifact'): Artifact[] {
  const captures = messages.flatMap((m) => {
    // `i` stays the image's place in its turn, so keys match the chat's thumbnails;
    // `place` counts only images of this role, for the 「n장째」 caption
    let place = 0
    return (m.images ?? []).flatMap((image, i) => roleOf(image) !== role
      ? []
      : [{
          key: artifactKey(m.id, i),
          sessionId: m.sessionId,
          url: image.url,
          width: image.width,
          height: image.height,
          // Images stored before turns existed have no `at`; they fall back to the message time
          at: image.at ?? m.at,
          source: image.source,
          dhash: image.dhash,
          m,
          place: place++,
        }])
  })
  // Turns from different sessions interleave, so arrival is by each image's own time.
  // Array#sort is stable, so ties keep message order.
  const arrival = new Map([...captures].sort((a, b) => a.at - b.at).map((c, n) => [c.key, n + 1]))
  const visible = new Set(shown.map(m => m.id))
  const out: Artifact[] = []
  stackCaptures(captures, split).forEach((stack, n) => {
    const newest = stack[stack.length - 1]!
    const { m, place, at } = newest
    if (!visible.has(m.id))
      return
    const prev = out.at(-1)
    const dayStart = !!prev && dayKey(prev.at) !== dayKey(at)
    out.push({
      // The first capture's key, so the cell keeps its selection when a new capture lands
      key: stack[0]!.key,
      messageId: m.id,
      url: newest.url,
      width: newest.width,
      height: newest.height,
      sessionId: m.sessionId,
      ...splitSessionName(m.sessionName),
      at,
      ...(newest.source ? { source: newest.source } : {}),
      runStart: !prev || prev.sessionId !== m.sessionId || dayStart || at - prev.at > RUN_GAP_MS,
      dayStart,
      seq: n + 1,
      arrival: arrival.get(newest.key)!,
      turnIndex: place,
      // MCP tool names read better without their server prefix
      label: m.toolName?.split('__').at(-1),
      ...(role === 'reference' ? { role } : {}),
      ...(stack.length > 1
        ? { versions: stack.map(c => ({ key: c.key, messageId: c.m.id, url: c.url, width: c.width, height: c.height, at: c.at, turnIndex: c.place, ...(c.source ? { source: c.source } : {}) })) }
        : {}),
    })
  })
  return out
}

/** The cell as it looks on one of its captures, for the viewer and feedback */
export function atVersion(a: Artifact, v: ArtifactVersion): Artifact {
  const { source: _, ...rest } = a
  return { ...rest, messageId: v.messageId, url: v.url, width: v.width, height: v.height, at: v.at, turnIndex: v.turnIndex, ...(v.source ? { source: v.source } : {}) }
}

/** References that arrived between two artifact cells, folded into one 「참고 이미지 n」 */
export interface ReferenceFold {
  /** The first reference's key, so a fold that grows keeps its open state */
  key: string
  /** Key of the artifact cell it follows; null before the first */
  after: string | null
  items: Artifact[]
}

/**
 * Folds references in between the artifact cells by time: each run of references with no
 * artifact between them is one fold, placed after the cell that came before it. Both lists
 * come from toArtifacts, ordered by each cell's newest capture.
 */
export function referenceFolds(artifacts: Artifact[], references: Artifact[]): ReferenceFold[] {
  const folds: ReferenceFold[] = []
  let a = 0
  for (const ref of references) {
    // An artifact that arrived at the same moment comes first
    while (a < artifacts.length && artifacts[a]!.at <= ref.at)
      a++
    const after = a > 0 ? artifacts[a - 1]!.key : null
    const last = folds.at(-1)
    if (last && last.after === after)
      last.items.push(ref)
    else
      folds.push({ key: ref.key, after, items: [ref] })
  }
  return folds
}

/** Maps every capture's key to the key of the cell showing it */
export function cellKeys(artifacts: Artifact[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const a of artifacts) {
    map.set(a.key, a.key)
    for (const v of a.versions ?? []) map.set(v.key, a.key)
  }
  return map
}

/** File name shown for a cell, when the tool named the file */
export const sourceName = (a: { source?: string }) => a.source ? basename(a.source) : undefined

/** Quiet hint under a cell that hides earlier captures */
export const versionsHint = (a: Artifact) => a.versions ? `같은 화면 ${a.versions.length}장` : undefined

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
