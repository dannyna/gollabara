import type { IncomingEvent, SessionInfo, Triage } from '../shared/types'
import type { EngineCall } from './engine'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { engineArgs, engineOutput, TRIAGE_SCHEMA } from './engine'
import { Store } from './store'
import { buildPrompt, cacheKey, FEEDBACK_LINES, JobQueue, toTriage, Triager } from './triage'

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
  test('keeps only show or hide; advice and drafts are dropped', () => {
    expect(toTriage({ verdict: 'show', tone: 'default', advice: '로그를 보세요', draft: '로그 보여 줘' }, at)).toEqual({ ...at, verdict: 'show', tone: 'default' })
    expect(toTriage({ verdict: 'hide' }, at)).toEqual({ ...at, verdict: 'hide' })
  })

  test('a shown line keeps its tone; a hidden one never carries one', () => {
    for (const tone of ['default', 'success', 'warning', 'danger'] as const)
      expect(toTriage({ verdict: 'show', tone }, at)).toEqual({ ...at, verdict: 'show', tone })
    expect(toTriage({ verdict: 'hide', tone: 'danger' }, at)).toEqual({ ...at, verdict: 'hide' })
  })

  test('a missing or unknown tone reads as default and keeps the verdict', () => {
    expect(toTriage({ verdict: 'show' }, at)).toEqual({ ...at, verdict: 'show', tone: 'default' })
    for (const tone of ['info', 'ok', 'warn', 'risk', 3])
      expect(toTriage({ verdict: 'show', tone }, at)).toEqual({ ...at, verdict: 'show', tone: 'default' })
  })

  test('rejects malformed answers and the old three-way verdicts', () => {
    expect(toTriage(null, at)).toBeNull()
    expect(toTriage('hide', at)).toBeNull()
    for (const verdict of ['signal', 'progress', 'noise', 'maybe'])
      expect(toTriage({ verdict }, at)).toBeNull()
  })
})

describe('verdicts stored before #37', () => {
  test('signal reads as shown, progress and noise as hidden, in the cache too', () => {
    const old = mkdtempSync(join(tmpdir(), 'gollabara-legacy-'))
    // The old schema also had advice and draft columns
    const legacy = new Database(join(old, 'stream.db'))
    legacy.run('CREATE TABLE triage (message_id INTEGER NOT NULL, idx INTEGER NOT NULL, verdict TEXT NOT NULL, advice TEXT, draft TEXT, PRIMARY KEY (message_id, idx))')
    legacy.run('CREATE TABLE triage_cache (key TEXT PRIMARY KEY, verdict TEXT NOT NULL)')
    legacy.run(`INSERT INTO triage VALUES (1, 0, 'signal', '로그를 보세요', '로그 보여 줘'), (2, 0, 'progress', NULL, NULL), (3, 0, 'noise', NULL, NULL)`)
    legacy.run(`INSERT INTO triage_cache VALUES ('# 분 경과', 'noise')`)
    legacy.close()
    try {
      const migrated = new Store(old)
      expect(migrated.triageFor([1, 2, 3])).toEqual([
        { messageId: 1, index: 0, verdict: 'show' },
        { messageId: 2, index: 0, verdict: 'hide' },
        { messageId: 3, index: 0, verdict: 'hide' },
      ])
      expect(migrated.cachedVerdict('# 분 경과')).toBe('hide')
      // New verdicts still write to the old table, which gains a tone column
      migrated.saveTriage({ messageId: 2, index: 0, verdict: 'show', tone: 'danger' })
      expect(new Store(old).triageFor([2])).toEqual([{ messageId: 2, index: 0, verdict: 'show', tone: 'danger' }])
    }
    finally {
      rmSync(old, { recursive: true, force: true })
    }
  })
})

describe('tone storage', () => {
  test('a tone is stored with the verdict; a later hide clears it', () => {
    store.saveTriage({ messageId: 1, index: 0, verdict: 'show', tone: 'warning' })
    store.saveTriage({ messageId: 2, index: 0, verdict: 'show' })
    expect(store.triageFor([1, 2])).toEqual([
      { messageId: 1, index: 0, verdict: 'show', tone: 'warning' },
      { messageId: 2, index: 0, verdict: 'show' },
    ])
    store.saveTriage({ messageId: 1, index: 0, verdict: 'hide' })
    expect(store.triageFor([1])).toEqual([{ messageId: 1, index: 0, verdict: 'hide' }])
  })
})

describe('engine output', () => {
  test('claude: structured_output, else the result text; errors give null', () => {
    expect(engineOutput('claude', JSON.stringify({ structured_output: { verdict: 'hide' } }))).toEqual({ verdict: 'hide' })
    expect(engineOutput('claude', JSON.stringify({ result: '{"verdict":"show"}' }))).toEqual({ verdict: 'show' })
    expect(engineOutput('claude', JSON.stringify({ is_error: true, structured_output: { verdict: 'hide' } }))).toBeNull()
    expect(engineOutput('claude', 'not json')).toBeNull()
  })

  test('codex: the answer file is the JSON itself', () => {
    expect(engineOutput('codex', '{"verdict":"hide"}')).toEqual({ verdict: 'hide' })
  })

  test('the schema asks for a tone with the verdict, so codex strict mode accepts it', () => {
    expect(TRIAGE_SCHEMA.required).toEqual(['verdict', 'tone'])
    expect(TRIAGE_SCHEMA.properties.tone.enum).toEqual(['default', 'success', 'warning', 'danger'])
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
    const prompt = buildPrompt({ session: 'piuda · main', hasImages: true, context: ['recap: 빌드 시작'], line: 'e2e 3건 통과' })
    expect(prompt).toContain('Session: piuda · main')
    expect(prompt).toContain('Turn has images: yes')
    expect(prompt).toContain('- recap: 빌드 시작')
    expect(prompt).toContain('New line (recap):\ne2e 3건 통과')
    expect(prompt).not.toContain('feedback')
  })

  test('feedback, when given, sits right before the new line', () => {
    expect(buildPrompt({ session: 'piuda', hasImages: false, context: [], feedback: '로그 보여 줘', line: '로그 첨부' }))
      .toContain('Developer\'s latest feedback to this session:\n로그 보여 줘\n\nNew line (recap):\n로그 첨부')
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
    const { triager, inputs, ingest } = setup(() => ({ verdict: 'hide' }))
    ingest(recap(a, '1분 경과'))
    await triager.queue.idle()
    expect(inputs).toEqual([])
  })

  test('judges each line of interleaved sessions with that session\'s own context', async () => {
    store.saveSettings({ triage: 'claude' })
    const { triager, published, inputs, ingest } = setup(input => ({ verdict: input.split('New line').at(-1)!.includes('경과') ? 'hide' : 'show' }))
    ingest(recap(a, '1분 경과, 피드백 없음'))
    await triager.queue.idle()
    ingest(recap(b, 'e2e 2건 실패'))
    ingest(recap(a, '배포 완료'))
    await triager.queue.idle()
    ingest(recap(b, '3분 경과, 피드백 없음'))
    await triager.queue.idle()

    expect(published.map(t => [t.messageId, t.verdict])).toEqual([[1, 'hide'], [2, 'show'], [3, 'show'], [4, 'hide']])
    // a's second line sees a's earlier line, not b's
    expect(inputs[2]).toContain('- recap: 1분 경과, 피드백 없음')
    expect(inputs[2]).not.toContain('e2e 2건 실패')
    // b's tick hit the hide cache from a's: no model call
    expect(inputs).toHaveLength(3)
    expect(store.triageFor([1, 2, 3, 4]).map(t => t.verdict)).toEqual(['hide', 'show', 'show', 'hide'])
  })

  test('a continuation judges only its new line; a failed call stores nothing', async () => {
    store.saveSettings({ triage: 'codex' })
    const { triager, published, ingest } = setup(input => input.endsWith('끝') ? { verdict: 'hide' } : null)
    ingest(recap(a, '빌드 중'))
    ingest(recap(a, '끝', true))
    await triager.queue.idle()
    expect(published).toEqual([{ messageId: 1, index: 1, verdict: 'hide' }])
  })

  test('questions are always shown, so they never go to the model', async () => {
    store.saveSettings({ triage: 'claude' })
    const { triager, published, inputs, ingest } = setup(() => ({ verdict: 'hide' }))
    ingest({ kind: 'question', session: a, questions: [{ question: '어느 쪽?', options: [{ label: 'A' }, { label: 'B' }] }] })
    await triager.queue.idle()
    expect(inputs).toEqual([])
    expect(published).toEqual([])
  })
})

describe('feedback context', () => {
  function setup() {
    store.saveSettings({ triage: 'claude' })
    const inputs: string[] = []
    const triager = new Triager(store, () => {}, {
      dataDir: dir,
      run: async (_engine, call) => {
        inputs.push(call.input)
        return { verdict: 'hide' }
      },
    })
    const ingest = async (event: IncomingEvent) => {
      triager.onIngest(event, store.ingest(event))
      await triager.queue.idle()
    }
    const deliver = (session: SessionInfo, text: string) => {
      store.queueFeedback(session.id, text)
      store.claimFeedback(session.id, 'stop')
    }
    const carried = () => inputs.map(i => i.includes('latest feedback'))
    return { triager, inputs, ingest, deliver, carried }
  }

  test('the first FEEDBACK_LINES lines after delivered feedback carry it', async () => {
    const { inputs, ingest, deliver, carried } = setup()
    await ingest(recap(a, '결제 e2e 2건 실패'))
    deliver(a, '실패한 2건 로그 보여 줘')
    // Feedback on Stop continues the turn: the answer joins a message older than the feedback
    await ingest(recap(a, '로그 첨부했어요', true))
    for (const text of ['원인 찾는 중', '수정 중', '다시 실행 중'])
      await ingest(recap(a, text))
    expect(FEEDBACK_LINES).toBe(3)
    expect(carried()).toEqual([false, true, true, true, false])
    expect(inputs[1]).toContain('Developer\'s latest feedback to this session:\n실패한 2건 로그 보여 줘\n\nNew line (recap):\n로그 첨부했어요')
  })

  test('newer feedback opens a new window; another session\'s feedback stays out', async () => {
    const { inputs, ingest, deliver, carried } = setup()
    await ingest(recap(a, '빌드 시작'))
    await ingest(recap(b, '테스트 시작'))
    deliver(a, '첫 번째 피드백')
    for (const step of ['설치', '빌드', '테스트', '배포'])
      await ingest(recap(a, `${step} 단계`))
    deliver(a, '두 번째 피드백')
    await ingest(recap(a, '두 번째에 답함'))
    await ingest(recap(b, '테스트 끝'))
    expect(carried()).toEqual([false, false, true, true, true, false, true, false])
    expect(inputs[6]).toContain('두 번째 피드백')
    expect(inputs[6]).not.toContain('첫 번째 피드백')
  })

  test('feedback delivered before the server started is not carried', async () => {
    store.ingest(recap(a, '빌드 시작'))
    store.queueFeedback(a.id, '예전 피드백')
    store.claimFeedback(a.id, 'stop', Date.now() - 60_000)
    const { inputs, ingest } = setup()
    await ingest(recap(a, '빌드 끝'))
    expect(inputs[0]).not.toContain('예전 피드백')
  })

  test('a line that answers feedback gets a tone like any shown line', async () => {
    const published: Triage[] = []
    store.saveSettings({ triage: 'claude' })
    const triager = new Triager(store, t => published.push(t), {
      dataDir: dir,
      run: async (_engine, call) => call.input.includes('latest feedback') ? { verdict: 'show', tone: 'success' } : { verdict: 'hide', tone: 'default' },
    })
    const ingest = async (event: IncomingEvent) => {
      triager.onIngest(event, store.ingest(event))
      await triager.queue.idle()
    }
    await ingest(recap(a, '결제 e2e 2건 실패'))
    store.queueFeedback(a.id, '다시 돌려 줘')
    store.claimFeedback(a.id, 'stop')
    await ingest(recap(a, 'e2e 다시 돌려서 전부 통과', true))
    expect(published).toEqual([{ messageId: 1, index: 0, verdict: 'hide' }, { messageId: 1, index: 1, verdict: 'show', tone: 'success' }])
    expect(store.triageFor([1])[1]).toEqual({ messageId: 1, index: 1, verdict: 'show', tone: 'success' })
  })

  test('a line after feedback skips the hide cache, so an answer is still judged', async () => {
    const { inputs, ingest, deliver } = setup()
    await ingest(recap(a, '테스트 통과'))
    await ingest(recap(b, '테스트 통과'))
    expect(inputs).toHaveLength(1)
    deliver(b, '통과했는지 알려 줘')
    await ingest(recap(b, '테스트 통과'))
    expect(inputs).toHaveLength(2)
    expect(inputs[1]).toContain('통과했는지 알려 줘')
  })
})

describe('settings', () => {
  test('default off; saved value survives a reopen', () => {
    expect(store.settings()).toEqual({ triage: 'off' })
    store.saveSettings({ triage: 'codex' })
    expect(new Store(dir).settings()).toEqual({ triage: 'codex' })
  })
})
