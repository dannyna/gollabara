// Sample data for the stream gallery only. Never imported by the app.
// Rails go through toArtifacts, so sequence numbers and dividers follow the app's rules.

import type { StreamMessage } from '../../../../src/shared/types'
import type { Artifact } from '../../artifacts'
import { toArtifacts } from '../../artifacts'

const T0 = new Date(2026, 9, 14, 14, 30).getTime()
const min = (n: number) => T0 + n * 60_000

/** A gray wireframe with only the original ratio; any ratio fills top down (OD guide's shot) */
function shot(w: number, h: number, tone: string, variant = 0) {
  const u = Math.min(w, h) / 14
  const cols = w / h > 1.2 ? 3 : 1
  const cw = (w - u * (cols + 1)) / cols
  const rect = (x: number, y: number, ww: number, hh: number, fill: string, r = u * 0.15) => `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="${r}" fill="${fill}"/>`
  let s = rect(0, 0, w, h, '#f4f5f7', 0) + rect(0, 0, w, u * 1.3, tone, 0) + rect(u, u * 2.2, w * (0.5 - variant * 0.08), u * 0.9, '#c9ced6') + rect(u, u * 3.7, w * 0.36, u * 0.5, '#dde1e6')
  let y = u * 4.9
  while (y + u * 4 < h - u * 2) {
    for (let c = 0; c < cols; c++)
      s += rect(u + c * (cw + u), y, cw, u * 3.4, '#e3e6ea', u * 0.3) + rect(u * 1.5 + c * (cw + u), y + u * 0.6, cw * 0.5, u * 0.4, '#c9ced6')
    y += u * 4.2
  }
  s += rect(u, h - u * 1.6, w * 0.3, u, tone, u * 0.2)
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`)}`
}

const BRANCH: Record<string, string> = { 'piuda': 'desktop-shell', 'od': 'landing-hero', 'client-e2e': 'checkout' }
const TONE: Record<string, string> = { 'piuda': '#3a3f4a', 'od': '#3d4a3a', 'client-e2e': '#4a3a3a' }

// One image per message, in arrival order. Landscape, portrait phone, square, a very
// tall page capture, and a very wide banner.
const SAMPLES = [
  { id: 'sidebar', session: 'piuda', w: 1440, h: 900, at: min(2), label: '사이드바 · 접힘 상태 저장' },
  { id: 'hero-a', session: 'od', w: 1440, h: 900, at: min(4), label: '히어로 A · 좌우 분할' },
  { id: 'hero-b', session: 'od', w: 1440, h: 900, at: min(4.5), label: '히어로 B · 중앙 정렬' },
  { id: 'hero-c', session: 'od', w: 1440, h: 900, at: min(5), label: '히어로 C · 큰 이미지' },
  { id: 'settings', session: 'piuda', w: 1440, h: 2000, at: min(6), label: '설정 페이지 · 전체 캡처' },
  { id: 'checkout-1', session: 'client-e2e', w: 390, h: 844, at: min(7), label: '결제 화면 · 첫 번째' },
  { id: 'checkout-2', session: 'client-e2e', w: 390, h: 844, at: min(8), label: '결제 화면 · 하단 버튼 잘림' },
  { id: 'icons', session: 'od', w: 1080, h: 1080, at: min(11), label: '아이콘 세트' },
  { id: 'checkout-full', session: 'client-e2e', w: 390, h: 2400, at: min(12), label: '결제 화면 전체 · 세로 캡처' },
  { id: 'banner', session: 'od', w: 2880, h: 540, at: min(13), label: '공지 띠 배너 · 아주 넓은 가로' },
] as const
export type SampleId = typeof SAMPLES[number]['id']

const MESSAGES: StreamMessage[] = SAMPLES.map((s, n) => ({
  id: n + 1,
  at: s.at,
  sessionId: s.session,
  sessionName: `${s.session} · ${BRANCH[s.session]}`,
  kind: 'turn',
  images: [{ url: shot(s.w, s.h, TONE[s.session]!, n % 3), width: s.w, height: s.h, at: s.at }],
}))

/** The given samples as the app would show them, numbered among all samples */
export function rail(ids: readonly SampleId[]): Artifact[] {
  const shown = MESSAGES.filter((_, n) => ids.includes(SAMPLES[n]!.id))
  return toArtifacts(MESSAGES, shown).map(a => ({ ...a, label: SAMPLES[a.messageId - 1]!.label }))
}

export const one = (id: SampleId) => rail([id])[0]!

export const ALL: SampleId[] = ['sidebar', 'hero-a', 'hero-b', 'hero-c', 'checkout-1', 'checkout-2']

/** One od turn with three images and no names, as real turns arrive */
export function turnRail(): Artifact[] {
  const images = [0, 1, 2].map(i => ({ url: shot(1440, 900, TONE.od!, i), width: 1440, height: 900, at: min(4 + i * 0.3) }))
  return toArtifacts([{ id: 1, at: min(4), sessionId: 'od', sessionName: 'od · landing-hero', kind: 'turn', images }])
}

/** The same session working past midnight */
export function dayRail(): Artifact[] {
  const at = [new Date(2026, 9, 13, 23, 48).getTime(), new Date(2026, 9, 14, 0, 6).getTime(), new Date(2026, 9, 14, 0, 9).getTime()]
  const labels = ['히어로 A · 좌우 분할', '히어로 B · 중앙 정렬', '히어로 C · 큰 이미지']
  const messages: StreamMessage[] = at.map((t, n) => ({
    id: n + 1,
    at: t,
    sessionId: 'od',
    sessionName: 'od · landing-hero',
    kind: 'turn',
    images: [{ url: shot(1440, 900, TONE.od!, n), width: 1440, height: 900, at: t }],
  }))
  return toArtifacts(messages).map((a, n) => ({ ...a, label: labels[n] }))
}

/** Planned non-image artifacts (guide 07): 16:10 with no preview */
export function documentSample(id: string, session: string, seq: number, minute: number, label: string): Artifact {
  return { key: id, messageId: 100 + seq, url: '', width: 1600, height: 1000, sessionId: session, session, branch: BRANCH[session], at: min(minute), runStart: false, seq, arrival: seq, turnIndex: 0, label }
}

// Re-captures and runs (#33). `mark` nudges one small rect so the bytes differ while the
// screen stays the same, as a real re-shoot does; the dHash is set by hand to match.
const SAME = 'ffffffff00000000'
interface Shot { session: 'od' | 'piuda', minute: number, file?: string, variant?: number, mark?: number, same?: boolean }

function captureMessages(shots: Shot[]): StreamMessage[] {
  return shots.map((s, n) => {
    const at = min(s.minute)
    let url = shot(390, 844, TONE[s.session]!, s.variant ?? n % 3)
    // Every shot gets its own bytes unless `mark: 0` asks for an exact copy
    const mark = s.mark ?? n + 20
    if (mark)
      url = url.replace(encodeURIComponent('</svg>'), encodeURIComponent(`<rect x="${mark * 9 % 370}" y="830" width="6" height="6" fill="#c9ced6"/></svg>`))
    // Distinct screens get far-apart hashes
    const dhash = s.same ? SAME : (0x1F3D5B79n * BigInt(n + 1)).toString(16).padStart(16, '0').slice(-16)
    return {
      id: n + 1,
      at,
      sessionId: s.session,
      sessionName: `${s.session} · ${BRANCH[s.session]}`,
      kind: 'turn',
      images: [{ url, width: 390, height: 844, at, ...(s.file ? { source: `/tmp/e2e/${s.file}`, dhash } : {}) }],
    }
  })
}

/** `count` captures of one login screen to the same file, a minute apart */
function reshots(count: number, from = 0): Shot[] {
  return Array.from({ length: count }, (_, i) => ({ session: 'od' as const, minute: from + i, file: 'p2-01-login.png', variant: 0, mark: i + 1, same: true }))
}

export const CAPTURE_SAMPLES = {
  two: () => toArtifacts(captureMessages(reshots(2))),
  five: () => toArtifacts(captureMessages(reshots(5))),
  mixed: () => toArtifacts(captureMessages([
    ...reshots(2),
    { session: 'od', minute: 2, file: 'p2-02-age-gate.png', variant: 1 },
    { session: 'od', minute: 3, file: 'p2-03-ai-consent-after-scrolling-down.png', variant: 2 },
    { session: 'od', minute: 4, file: 'p2-01-login.png', variant: 0, mark: 7, same: true },
  ])),
  // No source: only byte-identical captures hide
  identical: () => toArtifacts(captureMessages([
    { session: 'od', minute: 0, variant: 1, mark: 0 },
    { session: 'od', minute: 1, variant: 1, mark: 0 },
    { session: 'od', minute: 2, variant: 2 },
  ])),
  longRun: () => toArtifacts(captureMessages([0, 0.5, 1, 1.5, 2, 2.5].map((minute, i) => ({ session: 'od', minute, file: `r3-0${i + 1}-home.png`, variant: i % 3 })))),
  interleaved: () => toArtifacts(captureMessages([
    { session: 'od', minute: 0, file: 'hero-a.png', variant: 0 },
    { session: 'od', minute: 1, file: 'hero-b.png', variant: 1 },
    { session: 'piuda', minute: 2, file: 'sidebar.png', variant: 2 },
    { session: 'od', minute: 3, file: 'hero-c.png', variant: 2 },
  ])),
  gap: () => toArtifacts(captureMessages([
    { session: 'od', minute: 0, file: 'hero-a.png', variant: 0 },
    { session: 'od', minute: 2, file: 'hero-b.png', variant: 1 },
    { session: 'od', minute: 9, file: 'hero-c.png', variant: 2 },
    { session: 'od', minute: 10, file: 'hero-d.png', variant: 0 },
  ])),
  hiddenInRun: () => toArtifacts(captureMessages([
    { session: 'od', minute: 0, file: 'hero-a.png', variant: 1 },
    ...reshots(3, 1),
    { session: 'od', minute: 4, file: 'hero-b.png', variant: 2 },
  ])),
}
