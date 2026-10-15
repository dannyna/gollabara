// Runs a CLI already installed on this machine (claude or codex) for one triage call.
// The call is isolated from the user's sessions: no tools, no user settings or MCP where the
// CLI allows it, and GOLLABARA_HOOK=off so the gollabara hook never streams the call itself.

import type { TriageEngine } from '../shared/types'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

export const ENGINE_TIMEOUT_MS = 30_000

/** One schema for both CLIs; codex's strict mode needs every field required */
export const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['show', 'hide'] },
    tone: { type: 'string', enum: ['default', 'success', 'warning', 'danger'] },
  },
  required: ['verdict', 'tone'],
  additionalProperties: false,
} as const

export interface EngineCall {
  /** Instructions; claude takes them as the system prompt, codex gets them ahead of the input */
  system: string
  input: string
  /** Empty directory the CLI runs in, so no project CLAUDE.md or AGENTS.md is picked up */
  workDir: string
  /** Server URL: if a hook ever ignored GOLLABARA_HOOK, it would post here rather than elsewhere */
  selfUrl?: string
  timeoutMs?: number
}

/** Command line for one call. `files` are paths codex reads its schema from and writes its answer to. */
export function engineArgs(engine: Exclude<TriageEngine, 'off'>, call: EngineCall, files: { schema: string, out: string }): string[] {
  if (engine === 'claude') {
    return ['claude', '-p', '--model', 'haiku', '--output-format', 'json', '--json-schema', JSON.stringify(TRIAGE_SCHEMA), '--system-prompt', call.system, '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands', '--max-budget-usd', '0.05']
  }
  // --ignore-user-config would also drop a custom model provider, so codex keeps the user's config
  return ['codex', 'exec', '--ephemeral', '--ignore-rules', '--disable', 'hooks', '--skip-git-repo-check', '-s', 'read-only', '-C', call.workDir, '--output-schema', files.schema, '-o', files.out, '-c', 'model_reasoning_effort="low"', '-']
}

/** The structured answer out of the CLI's output, or null */
export function engineOutput(engine: Exclude<TriageEngine, 'off'>, stdout: string): unknown {
  try {
    if (engine === 'claude') {
      // --output-format json wraps the answer: structured_output, else the result text
      const envelope = JSON.parse(stdout) as { is_error?: boolean, structured_output?: unknown, result?: string }
      if (envelope.is_error)
        return null
      return envelope.structured_output ?? (envelope.result ? JSON.parse(envelope.result) : null)
    }
    return JSON.parse(stdout)
  }
  catch {
    return null
  }
}

/** Runs one call and returns the parsed answer, or null on any failure or timeout */
export async function runEngine(engine: Exclude<TriageEngine, 'off'>, call: EngineCall): Promise<unknown> {
  mkdirSync(call.workDir, { recursive: true })
  const files = { schema: join(call.workDir, 'schema.json'), out: join(call.workDir, `answer-${randomUUID()}.txt`) }
  if (engine === 'codex')
    writeFileSync(files.schema, JSON.stringify(TRIAGE_SCHEMA))
  const stdin = engine === 'codex' ? `${call.system}\n\n${call.input}` : call.input
  try {
    const proc = Bun.spawn(engineArgs(engine, call, files), {
      cwd: call.workDir,
      env: { ...process.env, GOLLABARA_HOOK: 'off', ...(call.selfUrl ? { GOLLABARA_URL: call.selfUrl } : {}) },
      stdin: new Response(stdin),
      stdout: 'pipe',
      stderr: 'ignore',
    })
    const timer = setTimeout(() => proc.kill(), call.timeoutMs ?? ENGINE_TIMEOUT_MS)
    const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    clearTimeout(timer)
    if (code !== 0)
      return null
    return engineOutput(engine, engine === 'codex' ? readFileSync(files.out, 'utf8') : stdout)
  }
  catch {
    // Not installed, killed, or no answer file
    return null
  }
  finally {
    rmSync(files.out, { force: true })
  }
}
