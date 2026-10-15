import type { Plugin, Rollup } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const api = 'http://127.0.0.1:4747'

/**
 * Emits /sw.js for production builds only, with the app shell to keep offline: the page, the
 * manifest and icons, and the entry chunk with what it loads up front. Fonts and lazy chunks
 * (the gallery) are cached when first used instead; there are a thousand font subsets.
 */
function serviceWorker(): Plugin {
  return {
    name: 'gollabara-sw',
    apply: 'build',
    generateBundle(_, bundle: Rollup.OutputBundle) {
      const entry = Object.values(bundle).find((f): f is Rollup.OutputChunk => f.type === 'chunk' && f.isEntry)
      if (!entry)
        return
      const files = new Set<string>()
      const visit = (chunk: Rollup.OutputChunk) => {
        if (files.has(chunk.fileName))
          return
        files.add(chunk.fileName)
        for (const css of chunk.viteMetadata?.importedCss ?? []) files.add(css)
        for (const name of chunk.imports) {
          const next = bundle[name]
          if (next?.type === 'chunk')
            visit(next)
        }
      }
      visit(entry)
      const shell = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', ...[...files].sort().map(f => `/${f}`)]
      const template = readFileSync(resolve(__dirname, 'sw.js'), 'utf8')
      // A new build is a new sw.js, which is what makes the browser update
      const build = createHash('sha256').update(template).update(shell.join('\n')).digest('hex').slice(0, 12)
      const source = template
        .replace('\'__BUILD__\'', JSON.stringify(build))
        .replace('[\'__SHELL__\']', JSON.stringify(shell))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  root: __dirname,
  plugins: [vue(), serviceWorker()],
  server: {
    port: 4748,
    proxy: {
      '/api': api,
      '/img': api,
      '/ws': { target: api.replace('http', 'ws'), ws: true },
    },
  },
})
