// Sample data for gallery cases only; the app bundle never imports this

import type { Question } from '../../../src/shared/types'

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
}

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
