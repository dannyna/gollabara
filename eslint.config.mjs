import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  formatters: true,
  ignores: [
    // 빌드 산출물 — plugin/bin/hook.js 는 build:hook 결과물이라 손대지 않는다(CI 가 drift 를 따로 검사).
    'plugin/bin/**',
    'web/dist/**',
    // Hook input capture spike (shell scripts, run logs) — not production code
    'spike/**',
    // Architecture SVGs are design artifacts
    'docs/**/*.svg',
    '.impeccable/**',
  ],
}, {
  // The CLI and server entry points print user-facing output to the console.
  files: ['src/cli.ts', 'src/server/index.ts'],
  rules: {
    'no-console': 'off',
  },
})
