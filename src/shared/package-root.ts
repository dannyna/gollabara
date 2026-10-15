// Where the gollabara package lives: the source checkout, the npm package, or the copy `golla setup` installs.
// Code runs from src/ in a checkout and from the dist/ bundle elsewhere, so files are found by walking up.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** The nearest directory at or above `from` whose package.json is gollabara's, or null */
export function packageRoot(from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    const file = join(dir, 'package.json')
    if (existsSync(file)) {
      try {
        if (JSON.parse(readFileSync(file, 'utf8')).name === 'gollabara')
          return dir
      }
      catch {}
    }
    if (dirname(dir) === dir)
      return null
  }
}
