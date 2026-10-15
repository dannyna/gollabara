// Which captures count as "the same screen", so the stream shows only the newest of them.
// Deterministic grouping only (AGENTS.md invariant 4): identical bytes, or one named file
// re-shot at the same size and a near-identical dHash. No score is shown or used to judge.

/** Most dHash bits two re-captures of one file may differ by and still count as the same screen */
export const DHASH_MAX_DISTANCE = 6

export interface Capture {
  /** Unique per capture, e.g. `<messageId>-<index>` */
  key: string
  sessionId: string
  /** Content-hash url: equal urls mean identical bytes */
  url: string
  width: number
  height: number
  at: number
  source?: string
  dhash?: string
}

/** Hamming distance between two 16-hex-char dHashes */
export function dhashDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let n = 0
  while (x) {
    x &= x - 1n
    n++
  }
  return n
}

/** Whether `next` re-captures `latest`: same bytes, or same file, size, and a near-identical picture */
export function sameCapture(latest: Capture, next: Capture): boolean {
  if (latest.sessionId !== next.sessionId)
    return false
  if (latest.url === next.url)
    return true
  return !!latest.source && latest.source === next.source
    && latest.width === next.width && latest.height === next.height
    && !!latest.dhash && !!next.dhash && dhashDistance(latest.dhash, next.dhash) <= DHASH_MAX_DISTANCE
}

/**
 * Groups captures into stacks, each oldest → newest, the stacks ordered by their newest
 * capture. A capture joins the most recent stack whose newest member it matches, so a
 * screen that drifts a little each time never chains into one stack. `split` holds keys the
 * reader took out (「따로 보기」): each stands alone, and nothing joins it.
 */
export function stackCaptures<T extends Capture>(captures: T[], split: ReadonlySet<string> = new Set()): T[][] {
  const ordered = [...captures].sort((a, b) => a.at - b.at)
  const stacks: T[][] = []
  // Candidate stacks by what their members looked like; checked against the newest member
  const index = new Map<string, T[][]>()
  const remember = (id: string, stack: T[]) => {
    const list = index.get(id)
    if (!list)
      index.set(id, [stack])
    else if (!list.includes(stack))
      list.push(stack)
  }
  const last = (stack: T[]) => stack[stack.length - 1]!

  for (const capture of ordered) {
    if (split.has(capture.key)) {
      stacks.push([capture])
      continue
    }
    const candidates = [
      ...index.get(`u:${capture.sessionId}:${capture.url}`) ?? [],
      ...(capture.source ? index.get(`s:${capture.sessionId}:${capture.source}`) ?? [] : []),
    ]
    let target: T[] | undefined
    for (const stack of candidates) {
      if (sameCapture(last(stack), capture) && (!target || last(stack).at > last(target).at))
        target = stack
    }
    if (target) {
      target.push(capture)
    }
    else {
      target = [capture]
      stacks.push(target)
    }
    remember(`u:${capture.sessionId}:${capture.url}`, target)
    if (capture.source)
      remember(`s:${capture.sessionId}:${capture.source}`, target)
  }
  return stacks.sort((a, b) => last(a).at - last(b).at)
}

/** `/tmp/sw-e2e/p2-01-login.png` → `p2-01-login.png` */
export const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path

/** Shortens a name in the middle, keeping the extension: `r3-05-very-long…name.png` */
export function middleTruncate(name: string, max = 28): string {
  const chars = [...name]
  if (chars.length <= max)
    return name
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && name.length - dot <= 6 ? [...name.slice(dot)] : []
  const room = max - ext.length - 1
  const head = Math.ceil(room * 0.6)
  const tail = room - head
  const stem = chars.slice(0, chars.length - ext.length)
  return `${stem.slice(0, head).join('')}…${tail > 0 ? stem.slice(-tail).join('') : ''}${ext.join('')}`
}
