// Hints that tell apart sessions whose names collide (two checkouts named `e2e-app`): the
// nearest parent directories that differ, the way an editor tells apart tabs. A name that
// collides with nothing gets no hint, so it reads exactly as before.

import type { Session } from '../../src/shared/types'
import { computed, shallowRef } from 'vue'
import { splitSessionName } from './artifacts'

type Named = Pick<Session, 'id' | 'name' | 'cwd'>

/**
 * Directories above the one the name comes from, nearest last. The cwd can be below the project
 * root the hook named the session after, so the path is cut at the last segment equal to the
 * name's dir; when there is none (an Open Design project id), the whole cwd is the path.
 */
export function parentDirs(session: Named): string[] {
  const dirs = (session.cwd ?? '').split('/').filter(Boolean)
  const at = dirs.lastIndexOf(splitSessionName(session.name).session)
  return at >= 0 ? dirs.slice(0, at) : dirs
}

/**
 * Hint per session id, such as `repo2/`, for sessions whose `keyOf(name)` is shared by another
 * session: the fewest trailing parent directories that no other session in the group ends with.
 * A path that runs out before it differs reads from the root (`/x/`). Sessions with the same
 * path get none, since no directory tells them apart.
 */
export function nameHints(sessions: Named[], keyOf: (name: string) => string = name => name): Map<string, string> {
  const groups = new Map<string, Named[]>()
  // One entry per id: the same session listed twice is not a collision
  for (const s of new Map(sessions.map(s => [s.id, s])).values()) {
    const key = keyOf(s.name)
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const hints = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length < 2)
      continue
    const paths = group.map(parentDirs)
    const longest = Math.max(...paths.map(p => p.length))
    paths.forEach((path, i) => {
      for (let k = 1; k <= longest; k++) {
        const tail = path.slice(-k).join('/')
        if (paths.every((other, j) => j === i || other.slice(-k).join('/') !== tail)) {
          hints.set(group[i]!.id, k > path.length ? `/${tail}${tail ? '/' : ''}` : `${tail}/`)
          return
        }
      }
    })
  }
  return hints
}

const known = shallowRef<Named[]>([])
const full = computed(() => nameHints(known.value))
const short = computed(() => nameHints(known.value, name => splitSessionName(name).session))

/** The sessions the server knows; App keeps this current so every surface hints alike */
export function setKnownSessions(sessions: Named[]) {
  known.value = sessions
}

/**
 * `hintOf` for labels that show the whole name (dir and branch), `shortHintOf` for those that
 * show only the dir (the queue tray, the composer target), where `e2e-app · feat` and `e2e-app`
 * collide too
 */
export function useNameHints() {
  return {
    hintOf: (id: string) => full.value.get(id),
    shortHintOf: (id: string) => short.value.get(id),
  }
}
