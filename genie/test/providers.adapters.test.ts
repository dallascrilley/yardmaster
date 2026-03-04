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
  output: 'json',
  timeoutMs: 20_000,
  noFallback: false,
}

describe('provider adapters', () => {
  it('builds expected invocation shapes', () => {
    expect(codexAdapter.buildInvocation(baseRequest)).toEqual({
      command: 'codex',
      args: ['run', 'hello'],
      cwd: '/tmp',
      timeoutMs: 20_000,
    })

    expect(claudeAdapter.buildInvocation(baseRequest).command).toBe('claude')
    expect(cursorAgentAdapter.buildInvocation(baseRequest).args.slice(0, 2)).toEqual(['chat', '--prompt'])
    expect(geminiAdapter.buildInvocation(baseRequest).args.slice(0, 2)).toEqual(['chat', 'hello'])
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
