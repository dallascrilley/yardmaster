import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/config/store.js', () => ({
  loadConfig: vi.fn(),
}))

vi.mock('../src/acp/run.js', () => ({
  runViaAcp: vi.fn(),
}))

vi.mock('../src/acp/command-runner.js', () => ({
  runAcpCommand: vi.fn(),
}))

vi.mock('../src/debug/command.js', async () => {
  const actual = await vi.importActual<typeof import('../src/debug/command.js')>('../src/debug/command.js')
  return {
    ...actual,
    readDebugInput: vi.fn().mockReturnValue('TypeError: bad'),
  }
})

import { loadConfig } from '../src/config/store.js'
import { runViaAcp } from '../src/acp/run.js'
import { runAcpCommand } from '../src/acp/command-runner.js'
import { handleDebugCommand, handleDesignCommand, handleRunCommand } from '../src/cli/dispatch/prompt-commands.js'
import type { ParsedCommand } from '../src/cli/types.js'
import { defaultConfig } from '../src/config/schema.js'

function baseGlobals() {
  return {
    help: false,
    version: false,
    json: true,
    plain: false,
    noColor: true,
    quiet: false,
    verbose: false,
    noInput: true,
  }
}

describe('prompt command json envelopes', () => {
  let stdout = ''
  let stderr = ''
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadConfig).mockResolvedValue(defaultConfig)
    stdout = ''
    stderr = ''
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += chunk.toString()
      return true
    })
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr += chunk.toString()
      return true
    })
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('emits the shared run json envelope including response payload', async () => {
    vi.mocked(runViaAcp).mockResolvedValue({
      provider: 'claude',
      stopReason: 'end_turn',
      response: 'hello world',
      sessionId: 'session-1',
      fallbackUsed: false,
      model: null,
      timings: {
        totalMs: 12,
        attempts: [{ provider: 'claude', stage: 'success', durationMs: 12, ok: true }],
      },
    })

    const parsed: Extract<ParsedCommand, { kind: 'run' }> = {
      kind: 'run',
      prompt: 'hello world',
      globals: baseGlobals(),
      options: { noFallback: true },
    }

    await handleRunCommand(parsed)

    expect(stderr).toBe('')
    const payload = JSON.parse(stdout)
    expect(payload).toMatchObject({
      kind: 'run_result',
      version: 1,
      ok: true,
      provider: 'claude',
      response: 'hello world',
      fallbackUsed: false,
      error: null,
    })
  })

  it('emits the shared design json envelope including provider and response', async () => {
    vi.mocked(runAcpCommand).mockResolvedValue({
      provider: 'claude',
      response: '## Overall direction',
      fallbackUsed: false,
      stopReason: 'end_turn',
    })

    const parsed: Extract<ParsedCommand, { kind: 'design' }> = {
      kind: 'design',
      prompt: 'audit hero',
      globals: baseGlobals(),
      options: { noFallback: true },
    }

    await handleDesignCommand(parsed)

    expect(JSON.parse(stdout)).toMatchObject({
      kind: 'design_result',
      version: 1,
      ok: true,
      provider: 'claude',
      response: '## Overall direction',
      error: null,
    })
  })

  it('emits the shared debug json envelope including provider and response', async () => {
    vi.mocked(runAcpCommand).mockResolvedValue({
      provider: 'claude',
      response: 'Root cause: mock',
      fallbackUsed: false,
      stopReason: 'end_turn',
    })

    const parsed: Extract<ParsedCommand, { kind: 'debug' }> = {
      kind: 'debug',
      globals: baseGlobals(),
      options: { noFallback: true },
    }

    await handleDebugCommand(parsed)

    expect(JSON.parse(stdout)).toMatchObject({
      kind: 'debug_result',
      version: 1,
      ok: true,
      provider: 'claude',
      response: 'Root cause: mock',
      error: null,
    })
  })
})
