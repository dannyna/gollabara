// Sample data for gallery cases only; the app bundle never imports this

import type { Question, Session, StreamMessage, Tone, Triage } from '../../../src/shared/types'

/** A fake screen with only the original aspect ratio, as in the OD guide */
export function shot(w: number, h: number, tone = '#2b3038'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f4f5f7"/><rect width="${w}" height="${h * 0.08}" fill="${tone}"/><rect x="${w * 0.06}" y="${h * 0.18}" width="${w * 0.5}" height="${h * 0.07}" rx="6" fill="#c9ced6"/><rect x="${w * 0.06}" y="${h * 0.3}" width="${w * 0.36}" height="${h * 0.04}" rx="4" fill="#dde1e6"/><rect x="${w * 0.06}" y="${h * 0.44}" width="${w * 0.88}" height="${h * 0.36}" rx="10" fill="#e3e6ea"/><rect x="${w * 0.06}" y="${h * 0.86}" width="${w * 0.26}" height="${h * 0.07}" rx="8" fill="${tone}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const IMG = {
  hero: { url: shot(1440, 900, '#34405a'), width: 1440, height: 900 },
  heroB: { url: shot(1440, 900, '#3d4a3a'), width: 1440, height: 900 },
  c1: { url: shot(390, 844, '#2b3038'), width: 390, height: 844 },
  c2: { url: shot(390, 844, '#4a3a3a'), width: 390, height: 844 },
}

/** Today at hh:mm */
export const time = (h: number, m: number) => new Date().setHours(h, m, 0, 0)

export const S = {
  od: 'od · landing-hero',
  piuda: 'piuda · desktop-shell',
  e2e: 'client-e2e · checkout',
  api: 'api · quota-refill',
  starwrite: 'starwrite · fix/1011-zoomed-out-star-brightness',
  docs: 'docs · feat/971-search-index-rebuild',
  infra: 'infra',
}

/** A turn of the session named `name` (the name doubles as its id) */
export function turn(id: number, name: string, at: number, recaps: string | string[], extra: Partial<StreamMessage> = {}): StreamMessage {
  const list = typeof recaps === 'string' ? [recaps] : recaps
  return { id, at, sessionId: name, sessionName: name, kind: 'turn', recaps: list, text: list.join('\n'), ...extra }
}

/** Verdicts as the server sends them */
export const show = (messageId: number, tone?: Tone, index = 0): Triage => ({ messageId, index, verdict: 'show', ...(tone ? { tone } : {}) })
export const hide = (messageId: number, index = 0): Triage => ({ messageId, index, verdict: 'hide' })

export const started = (name: string, at: number): Session => ({ id: name, name, harness: 'claude-code', cwd: '/', startedAt: at, lastSeenAt: at })

export const HERO_SHORT: Question = {
  header: '히어로 방향',
  question: '히어로 시안 3안 중 어느 쪽으로 갈까요?',
  options: [{ label: 'A' }, { label: 'B (Recommended)' }, { label: 'C' }],
}

export const HERO_ROWS: Question = {
  header: '히어로 방향',
  question: '히어로 시안 3안 중 어느 쪽으로 갈까요?',
  options: [
    { label: 'A · 좌우 분할', description: '제품 창을 오른쪽, 카피를 왼쪽에 둔다' },
    { label: 'B · 풀블리드 제품 창 (Recommended)', description: '제품 창이 화면 폭을 다 쓰고 카피는 위에' },
    { label: 'C · 카드 겹침', description: '제품 창 위에 피드백 카드를 겹친다' },
  ],
}

export const E2E_MULTI: Question = {
  header: '검증 범위',
  question: '어떤 화면을 먼저 검증할까요?',
  multiSelect: true,
  options: [
    { label: '결제 화면', description: '카드 입력 · 결제 버튼 노출' },
    { label: '장바구니', description: '수량 변경 · 쿠폰 적용' },
    { label: '주문 완료', description: '영수증 · 홈으로 돌아가기' },
  ],
}

/** One AskUserQuestion with three questions of different heights (OD question-stepper.html) */
export const ENDED_SET: Question[] = [
  {
    header: '끝난 세션',
    question: '전체 세션 목록에는 지금 23개가 떠요 … 끝난 세션은 어떻게 할까요?',
    options: [
      { label: '검색할 때만 보이기 (Recommended)', description: '평소 목록에서는 빼고, 검색 결과에서만 보여 줘요.' },
      { label: '완전히 숨기기', description: '전체 세션 목록과 검색 결과에서 모두 숨겨요.' },
      { label: '맨 아래에 접어 두기', description: '목록 아래에 모아 두고, 펼치면 볼 수 있어요.' },
    ],
  },
  {
    header: '대화 표시',
    question: '대화창에 남은 끝난 세션의 지난 메시지에는 … 어떻게 할까요?',
    options: [{ label: '흐리게만' }, { label: '「끝남」 글자 빼기 (Recommended)' }, { label: '지금처럼 유지' }, { label: '아무 표시 없이' }],
  },
  {
    header: '확인 순서',
    question: '변경한 내용을 어디부터 확인할까요?',
    options: [{ label: '세션 목록' }, { label: '대화창' }],
  },
]
