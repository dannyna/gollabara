// Sample data for the overlay gallery only. Never imported by the app.

import type { Artifact } from '../../artifacts'
import type { SessionRow } from '../../sessions'

const T0 = new Date(2026, 9, 14, 14, 30).getTime()
const min = (n: number) => T0 + n * 60_000

/** A gray wireframe with only the original ratio, like the OD guide's samples */
function shot(w: number, h: number, tone: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f4f5f7"/><rect width="${w}" height="${h * 0.08}" fill="${tone}"/><rect x="${w * 0.06}" y="${h * 0.18}" width="${w * 0.5}" height="${h * 0.07}" rx="6" fill="#c9ced6"/><rect x="${w * 0.06}" y="${h * 0.3}" width="${w * 0.36}" height="${h * 0.04}" rx="4" fill="#dde1e6"/><rect x="${w * 0.06}" y="${h * 0.44}" width="${w * 0.88}" height="${h * 0.36}" rx="10" fill="#e3e6ea"/><rect x="${w * 0.06}" y="${h * 0.86}" width="${w * 0.26}" height="${h * 0.07}" rx="8" fill="${tone}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function artifact(seq: number, sessionId: string, branch: string, w: number, h: number, at: number, label: string, tone: string): Artifact {
  return { key: `${seq}-0`, messageId: seq, url: shot(w, h, tone), width: w, height: h, sessionId, session: sessionId, branch, at, runStart: true, seq, arrival: seq, label }
}

export const SAMPLE_ARTIFACTS: Artifact[] = [
  artifact(1, 'piuda', 'desktop-shell', 1440, 900, min(2), '데스크톱 셸 · 사이드바', '#3a4250'),
  artifact(2, 'od', 'landing-hero', 1440, 900, min(3), '히어로 A · 왼쪽 정렬', '#3d4a3a'),
  artifact(3, 'od', 'landing-hero', 1440, 900, min(4), '히어로 B · 중앙 정렬', '#3d4a3a'),
  artifact(4, 'od', 'landing-hero', 1440, 900, min(5), '히어로 C · 큰 이미지', '#3d4a3a'),
  artifact(5, 'client-e2e', 'checkout', 390, 844, min(7), '결제 화면 · 주소 입력', '#4a3a3a'),
  artifact(6, 'client-e2e', 'checkout', 390, 844, min(8), '결제 화면 · 하단 버튼 잘림', '#4a3a3a'),
]

export const SAMPLE_SESSIONS: SessionRow[] = [
  { id: 'piuda', session: 'piuda', branch: 'desktop-shell', lastSeenAt: min(2), muted: false, ended: false, live: true, harness: 'claude-code', state: 'working' },
  { id: 'od', session: 'od', branch: 'landing-hero', lastSeenAt: min(5), muted: false, ended: false, live: true, harness: 'open-design', state: 'waiting' },
  { id: 'client-e2e', session: 'client-e2e', branch: 'checkout', lastSeenAt: min(8), muted: false, ended: false, live: true, harness: 'codex', state: 'idle' },
  { id: 'api', session: 'api', branch: 'quota-refill', lastSeenAt: min(9), muted: true, ended: false, live: true, harness: 'claude-code', state: 'idle' },
]

/** The session menu's 「n분 전」 counts from here, a few minutes after the samples */
export const SAMPLE_NOW = min(11)
