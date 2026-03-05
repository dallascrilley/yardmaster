import { describe, expect, it } from 'vitest'

import { claudeAdapter } from '../src/providers/claude.js'
import { codexAdapter } from '../src/providers/codex.js'
import { cursorAgentAdapter } from '../src/providers/cursor-agent.js'
import { geminiAdapter } from '../src/providers/gemini.js'
import { type NormalizedRequest } from '../src/types.js'

const baseRequest: NormalizedRequest = {
  prompt: 'hello',
  workspace: '/tmp',
  mode: 'default',
  trust: false,
  yolo: false,
  includeDirectories: [],
  outputFormat: 'text',
  headless: true,
  extensions: [],
  mcp: [],
  output: 'json',
  timeoutMs: 20_000,
  noFallback: false,
}

describe('provider adapters', () => {
  it('builds expected invocation shapes', () => {
    expect(codexAdapter.buildInvocation(baseRequest)).toEqual({
      command: 'codex',
      args: ['exec', 'hello'],
      cwd: '/tmp',
      timeoutMs: 20_000,
    })

    expect(claudeAdapter.buildInvocation(baseRequest).command).toBe('claude')
    expect(cursorAgentAdapter.buildInvocation(baseRequest).args).toEqual(['hello', '--print', '--output-format', 'text'])
    expect(geminiAdapter.buildInvocation(baseRequest).args).toEqual(['--prompt', 'hello', '--output-format', 'text'])
  })

  it('maps provider-specific advanced flags', () => {
    const advanced: NormalizedRequest = {
      ...baseRequest,
      mode: 'plan',
      trust: true,
      yolo: true,
      includeDirectories: ['a', 'b'],
      outputFormat: 'json',
      extensions: ['ext-a'],
      mcp: ['mcp-a'],
    }

    expect(codexAdapter.buildInvocation(advanced).args).toEqual([
      'exec',
      'hello',
      '--add-dir',
      'a',
      '--add-dir',
      'b',
      '--json',
      '--dangerously-bypass-approvals-and-sandbox',
    ])

    expect(claudeAdapter.buildInvocation(advanced).args).toEqual([
      'hello',
      '--permission-mode',
      'plan',
      '--print',
      '--output-format',
      'json',
      '--add-dir',
      'a',
      '--add-dir',
      'b',
      '--mcp-config',
      'mcp-a',
    ])

    expect(cursorAgentAdapter.buildInvocation(advanced).args).toEqual([
      'hello',
      '--mode',
      'plan',
      '--trust',
      '--yolo',
      '--print',
      '--output-format',
      'json',
      '--approve-mcps',
    ])

    expect(geminiAdapter.buildInvocation(advanced).args).toEqual([
      '--prompt',
      'hello',
      '--approval-mode',
      'plan',
      '--yolo',
      '--output-format',
      'json',
      '--include-directories',
      'a,b',
      '--extensions',
      'ext-a',
      '--allowed-mcp-server-names',
      'mcp-a',
    ])
  })

  it('parses response preferring stdout and tolerant stderr warnings', () => {
    expect(
      codexAdapter.parse({
        code: 0,
        stdout: 'answer',
        stderr: 'warning: noisy',
      }).text,
    ).toBe('answer')

    expect(
      codexAdapter.parse({
        code: 0,
        stdout: '',
        stderr: 'warning: ignore\nreal response',
      }).text,
    ).toBe('real response')
  })
})
