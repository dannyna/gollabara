import type { IncomingEvent, SessionInfo, Triage } from '../shared/types'
import type { EngineCall } from './engine'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { engineArgs, engineOutput } from './engine'
import { Store } from './store'
import { buildPrompt, cacheKey, JobQueue, toTriage, Triager } from './triage'

const a: SessionInfo = { id: 'a', name: 'piuda · main', harness: 'claude-code', cwd: '/a' }
const b: SessionInfo = { id: 'b', name: 'checkout', harness: 'claude-code', cwd: '/b' }
const recap = (session: SessionInfo, text: string, continuation?: boolean): IncomingEvent => ({ kind: 'recap', session, text, ...(continuation ? { continuation } : {}) })
const at = { messageId: 1, index: 0 }

let dir: string
let store: Store
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gollabara-triage-'))
  store = new Store(dir)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('toTriage', () => {
  test('keeps advice and draft on signal lines only', () => {
    expect(toTriage({ verdict: 'signal', advice: '로그를 보세요', draft: '로그 보여 줘' }, at, 'recap'))
      .toEqual({ ...at, verdict: 'signal', advice: '로그를 보세요', draft: '로그 보여 줘' })
    expect(toTriage({ verdict: 'progress', advice: '기다리세요', draft: '계속해' }, at, 'recap')).toEqual({ ...at, verdict: 'progress' })
    expect(toTriage({ verdict: 'noise', advice: '', draft: '' }, at, 'recap')).toEqual({ ...at, verdict: 'noise' })
  })

  test('a question is never noise', () => {
    expect(toTriage({ verdict: 'noise', advice: 'A를 고르세요', draft: '' }, at, 'question')).toEqual({ ...at, verdict: 'signal', advice: 'A를 고르세요' })
  })

  test('rejects malformed answers and clamps long text', () => {
    expect(toTriage(null, at, 'recap')).toBeNull()
    expect(toTriage('noise', at, 'recap')).toBeNull()
    expect(toTriage({ verdict: 'maybe' }, at, 'recap')).toBeNull()
    const long = toTriage({ verdict: 'signal', advice: '가'.repeat(300), draft: ' \n ' }, at, 'recap')!
    expect([...long.advice!].length).toBe(120)
    expect(long.advice!.endsWith('…')).toBe(true)
    expect(long.draft).toBeUndefined()
  })
})

describe('engine output', () => {
  test('claude: structured_output, else the result text; errors give null', () => {
    expect(engineOutput('claude', JSON.stringify({ structured_output: { verdict: 'noise' } }))).toEqual({ verdict: 'noise' })
    expect(engineOutput('claude', JSON.stringify({ result: '{"verdict":"signal"}' }))).toEqual({ verdict: 'signal' })
    expect(engineOutput('claude', JSON.stringify({ is_error: true, structured_output: { verdict: 'noise' } }))).toBeNull()
    expect(engineOutput('claude', 'not json')).toBeNull()
  })

  test('codex: the answer file is the JSON itself', () => {
    expect(engineOutput('codex', '{"verdict":"progress","advice":"","draft":""}')).toEqual({ verdict: 'progress', advice: '', draft: '' })
  })

  test('both CLIs run without tools, user settings or hooks', () => {
    const call: EngineCall = { system: 'sys', input: 'in', workDir: '/w' }
    const claude = engineArgs('claude', call, { schema: '/w/s.json', out: '/w/o.txt' })
    expect(claude.slice(0, 4)).toEqual(['claude', '-p', '--model', 'haiku'])
    expect(claude.join(' ')).toContain('--tools  --setting-sources  --strict-mcp-config')
    const codex = engineArgs('codex', call, { schema: '/w/s.json', out: '/w/o.txt' })
    expect(codex.join(' ')).toContain('exec --ephemeral --ignore-rules --disable hooks')
    expect(codex.join(' ')).toContain('-s read-only -C /w --output-schema /w/s.json -o /w/o.txt')
  })
})

describe('prompt and cache', () => {
  test('the prompt carries the session, images, earlier lines, and the new line', () => {
    const prompt = buildPrompt({ session: 'piuda · main', hasImages: true, context: ['recap: 빌드 시작'], line: { kind: 'recap', text: 'e2e 3건 통과' } })
    expect(prompt).toContain('Session: piuda · main')
    expect(prompt).toContain('Turn has images: yes')
    expect(prompt).toContain('- recap: 빌드 시작')
    expect(prompt).toContain('New line (recap):\ne2e 3건 통과')
  })

  test('numbers, case and spacing do not change the key', () => {
    expect(cacheKey('1/10 경과,  서버 정상.')).toBe(cacheKey('7/10 경과, 서버 정상.'))
    expect(cacheKey('Waiting 5 min')).toBe(cacheKey('waiting 12 min'))
    expect(cacheKey('e2e 통과')).not.toBe(cacheKey('e2e 실패'))
  })
})

describe('JobQueue', () => {
  test('runs at most `concurrency` jobs at once, each key once', async () => {
    let active = 0
    let peak = 0
    const ran: string[] = []
    const queue = new JobQueue<string>(async (job) => {
      active++
      peak = Math.max(peak, active)
      await Bun.sleep(5)
      ran.push(job)
      active--
    }, 2)
    for (const k of ['a', 'b', 'a', 'c', 'd'])
      queue.push(k, k)
    await queue.idle()
    expect(peak).toBe(2)
    expect(ran.sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  test('drops the oldest waiting job past max, and survives a failing job', async () => {
    const ran: string[] = []
    const queue = new JobQueue<string>(async (job) => {
      await Bun.sleep(1)
      if (job === 'x')
        throw new Error('boom')
      ran.push(job)
    }, 1, 2)
    for (const k of ['x', 'a', 'b', 'c'])
      queue.push(k, k)
    await queue.idle()
    // x runs at once; a waits, then b and c push it out
    expect(ran).toEqual(['b', 'c'])
  })
})

describe('Triager', () => {
  function setup(answer: (input: string) => unknown) {
    const published: Triage[] = []
    const inputs: string[] = []
    const triager = new Triager(store, t => published.push(t), {
      dataDir: dir,
      run: async (_engine, call) => {
        inputs.push(call.input)
        return answer(call.input)
      },
    })
    const ingest = (event: IncomingEvent) => triager.onIngest(event, store.ingest(event))
    return { triager, published, inputs, ingest }
  }

  test('does nothing while the engine is off', async () => {
    const { triager, inputs, ingest } = setup(() => ({ verdict: 'noise' }))
    ingest(recap(a, '1분 경과'))
    await triager.queue.idle()
    expect(inputs).toEqual([])
  })

  test('judges each line of interleaved sessions with that session\'s own context', async () => {
    store.saveSettings({ triage: 'claude' })
    const { triager, published, inputs, ingest } = setup(input => input.split('New line').at(-1)!.includes('경과')
      ? { verdict: 'noise', advice: 'x', draft: 'y' }
      : { verdict: 'signal', advice: '확인하세요', draft: '로그 보여 줘' })
    ingest(recap(a, '1분 경과, 피드백 없음'))
    await triager.queue.idle()
    ingest(recap(b, 'e2e 2건 실패'))
    ingest(recap(a, '배포 완료'))
    await triager.queue.idle()
    ingest(recap(b, '3분 경과, 피드백 없음'))
    await triager.queue.idle()

    expect(published.map(t => [t.messageId, t.verdict])).toEqual([[1, 'noise'], [2, 'signal'], [3, 'signal'], [4, 'noise']])
    expect(published[1]).toMatchObject({ advice: '확인하세요', draft: '로그 보여 줘' })
    // a's second line sees a's earlier line, not b's
    expect(inputs[2]).toContain('- recap: 1분 경과, 피드백 없음')
    expect(inputs[2]).not.toContain('e2e 2건 실패')
    // b's tick hit the noise cache from a's: no model call
    expect(inputs).toHaveLength(3)
    expect(store.triageFor([1, 2, 3, 4]).map(t => t.verdict)).toEqual(['noise', 'signal', 'signal', 'noise'])
  })

  test('a continuation judges only its new line; a failed call stores nothing', async () => {
    store.saveSettings({ triage: 'codex' })
    const { triager, published, ingest } = setup(input => input.endsWith('끝') ? { verdict: 'progress' } : null)
    ingest(recap(a, '빌드 중'))
    ingest(recap(a, '끝', true))
    await triager.queue.idle()
    expect(published).toEqual([{ messageId: 1, index: 1, verdict: 'progress' }])
  })

  test('questions get advice and are never hidden', async () => {
    store.saveSettings({ triage: 'claude' })
    const { triager, published, ingest } = setup(() => ({ verdict: 'noise', advice: 'B가 안전해요', draft: 'B로 가자' }))
    ingest({ kind: 'question', session: a, questions: [{ question: '어느 쪽?', options: [{ label: 'A' }, { label: 'B' }] }] })
    await triager.queue.idle()
    expect(published).toEqual([{ messageId: 1, index: 0, verdict: 'signal', advice: 'B가 안전해요', draft: 'B로 가자' }])
  })
})

describe('settings', () => {
  test('default off; saved value survives a reopen', () => {
    expect(store.settings()).toEqual({ triage: 'off' })
    store.saveSettings({ triage: 'codex' })
    expect(new Store(dir).settings()).toEqual({ triage: 'codex' })
  })
})
