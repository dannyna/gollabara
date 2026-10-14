// Sample stream for the banner gallery: the sessions and screens of the OD guide.
// Images are grey wireframes that only carry the original ratio.

import type { StreamMessage } from '../../../../src/shared/types'

function shot(w: number, h: number, tone: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f4f5f7"/><rect width="${w}" height="${h * 0.08}" fill="${tone}"/><rect x="${w * 0.06}" y="${h * 0.18}" width="${w * 0.5}" height="${h * 0.07}" rx="6" fill="#c9ced6"/><rect x="${w * 0.06}" y="${h * 0.3}" width="${w * 0.36}" height="${h * 0.04}" rx="4" fill="#dde1e6"/><rect x="${w * 0.06}" y="${h * 0.44}" width="${w * 0.88}" height="${h * 0.36}" rx="10" fill="#e3e6ea"/><rect x="${w * 0.06}" y="${h * 0.86}" width="${w * 0.26}" height="${h * 0.07}" rx="8" fill="${tone}"/></svg>`
  return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, width: w, height: h }
}

// 14:32 today, so the clock reads like the guide
const T = new Date().setHours(14, 32, 0, 0)
const min = (n: number) => T + n * 60_000

export const SAMPLE_MESSAGES: StreamMessage[] = [
  {
    id: 1,
    at: min(0),
    sessionId: 'piuda',
    sessionName: 'piuda · desktop-shell',
    kind: 'turn',
    images: [{ ...shot(1440, 900, '#3a3f4a'), at: min(0) }],
    recaps: ['사이드바 접힘 상태를 저장하도록 바꿨어.'],
  },
  {
    id: 2,
    at: min(2),
    sessionId: 'od',
    sessionName: 'od · landing-hero',
    kind: 'turn',
    images: [
      { ...shot(1440, 900, '#3d4a3a'), at: min(2) },
      { ...shot(1440, 900, '#3d4a3a'), at: min(2) },
      { ...shot(1440, 900, '#3d4a3a'), at: min(3) },
    ],
    recaps: ['히어로 시안 3개 뽑았어.'],
    questions: [{ question: '히어로 시안 3안 중 어느 쪽으로 갈까요?', header: '히어로 방향', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] }],
  },
  {
    id: 3,
    at: min(5),
    sessionId: 'client-e2e',
    sessionName: 'client-e2e · checkout',
    kind: 'turn',
    images: [{ ...shot(390, 844, '#4a3a3a'), at: min(5) }, { ...shot(390, 844, '#4a3a3a'), at: min(6) }],
    recaps: ['결제 화면 두 가지 상태를 캡처했어.'],
  },
]
