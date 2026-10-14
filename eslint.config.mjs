import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  formatters: true,
  ignores: [
    // 빌드 산출물 — plugin/bin/hook.js 는 build:hook 결과물이라 손대지 않는다(CI 가 drift 를 따로 검사).
    'plugin/bin/**',
    'web/dist/**',
    // 훅 입력 포착 스파이크(셸 스크립트 · 실행 로그) — production 코드 아님
    'spike/**',
    // 구조도 SVG 는 디자인 산출물
    'docs/**/*.svg',
    '.impeccable/**',
  ],
}, {
  // CLI 와 서버 진입점은 사용자에게 보여 줄 출력을 console 로 낸다.
  files: ['src/cli.ts', 'src/server/index.ts'],
  rules: {
    'no-console': 'off',
  },
})
