import type { Session } from '../../src/shared/types'
import { describe, expect, it } from 'bun:test'
import { splitSessionName } from './artifacts'
import { nameHints, parentDirs } from './names'

const s = (id: string, name: string, cwd: string): Pick<Session, 'id' | 'name' | 'cwd'> => ({ id, name, cwd })
const hints = (...sessions: Pick<Session, 'id' | 'name' | 'cwd'>[]) => Object.fromEntries(nameHints(sessions))

describe('nameHints', () => {
  it('gives no hint to names that collide with nothing', () => {
    expect(hints(s('a', 'e2e-app', '/u/repo/e2e-app'), s('b', 'api · feat/x', '/u/repo/api'))).toEqual({})
  })

  it('tells two colliding sessions apart by their parent directory', () => {
    expect(hints(s('a', 'e2e-app', '/u/repo/e2e-app'), s('b', 'e2e-app', '/u/repo2/e2e-app'), s('c', 'api', '/u/repo/api')))
      .toEqual({ a: 'repo/', b: 'repo2/' })
  })

  it('gives each of three the fewest directories that set it apart', () => {
    expect(hints(s('a', 'web', '/p/x/web'), s('b', 'web', '/q/x/web'), s('c', 'web', '/r/y/web')))
      .toEqual({ a: 'p/x/', b: 'q/x/', c: 'y/' })
  })

  it('reaches for the second directory when the first is shared', () => {
    expect(hints(s('a', 'web · feat', '/work/one/web'), s('b', 'web · feat', '/home/one/web')))
      .toEqual({ a: 'work/one/', b: 'home/one/' })
  })

  it('reads a path that runs out first from the root', () => {
    expect(hints(s('a', 'web', '/x/web'), s('b', 'web', '/a/x/web'))).toEqual({ a: '/x/', b: 'a/x/' })
  })

  it('does not count the same session listed twice as a collision', () => {
    expect(hints(s('a', 'e2e-app', '/u/repo/e2e-app'), s('a', 'e2e-app', '/u/repo/e2e-app/src'))).toEqual({})
  })

  it('leaves sessions with the same path alone', () => {
    expect(hints(s('a', 'od-project', '/od/data'), s('b', 'od-project', '/od/data'))).toEqual({})
  })

  it('collides on the key it is given, such as the dir alone', () => {
    const sessions = [s('a', 'web', '/u/one/web'), s('b', 'web · feat', '/u/two/web')]
    expect(Object.fromEntries(nameHints(sessions))).toEqual({})
    expect(Object.fromEntries(nameHints(sessions, name => splitSessionName(name).session))).toEqual({ a: 'one/', b: 'two/' })
  })
})

describe('parentDirs', () => {
  it('cuts the cwd at the project dir, even from a subdirectory', () => {
    expect(parentDirs(s('a', 'e2e-app · feat', '/u/repo/e2e-app/web/src'))).toEqual(['u', 'repo'])
  })

  it('uses the whole cwd when the name is no directory in it', () => {
    expect(parentDirs(s('a', 'landing-page', '/od/data'))).toEqual(['od', 'data'])
  })
})
