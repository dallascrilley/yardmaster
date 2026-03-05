import { describe, expect, it } from 'vitest'

import type { NormalizedRequest, ProviderAdapter } from '../src/types.js'
import { executeWithFallback } from '../src/execution/fallback.js'

const request: NormalizedRequest = {
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
  output: 'auto',
  timeoutMs: 10_000,
  noFallback: false,
}

describe('fallback telemetry', () => {
  it('captures attempt telemetry and marks fallbackUsed', async () => {
    const providers: ProviderAdapter[] = [
      {
        id: 'claude',
        isAvailable: async () => ({ ok: true }),
        isAuthenticated: async () => ({ ok: false, reason: 'auth required', authFailure: true }),
        buildInvocation: () => ({ command: 'claude', args: [] }),
        execute: async () => ({ text: 'nope', raw: { code: 1, stdout: '', stderr: '' } }),
        parse: (raw) => ({ text: raw.stdout, raw }),
      },
      {
        id: 'codex',
        isAvailable: async () => ({ ok: true }),
        isAuthenticated: async () => ({ ok: true }),
        buildInvocation: () => ({ command: 'codex', args: [] }),
        execute: async () => ({ text: 'ok', raw: { code: 0, stdout: 'ok', stderr: '' } }),
        parse: (raw) => ({ text: raw.stdout, raw }),
      },
    ]

    const result = await executeWithFallback({
      providers,
      order: ['claude', 'codex'],
      request,
      runner: async () => ({ code: 0, stdout: '', stderr: '' }),
    })

    expect(result.result.fallbackUsed).toBe(true)
    expect(result.result.timings.attempts.length).toBeGreaterThan(1)
    expect(result.result.timings.attempts[0]?.provider).toBe('claude')
  })

  it('respects no-fallback by trying only one provider', async () => {
    const providers: ProviderAdapter[] = [
      {
        id: 'claude',
        isAvailable: async () => ({ ok: true }),
        isAuthenticated: async () => ({ ok: true }),
        buildInvocation: () => ({ command: 'claude', args: [] }),
        execute: async () => {
          throw new Error('boom')
        },
        parse: (raw) => ({ text: raw.stdout, raw }),
      },
      {
        id: 'codex',
        isAvailable: async () => ({ ok: true }),
        isAuthenticated: async () => ({ ok: true }),
        buildInvocation: () => ({ command: 'codex', args: [] }),
        execute: async () => ({ text: 'ok', raw: { code: 0, stdout: 'ok', stderr: '' } }),
        parse: (raw) => ({ text: raw.stdout, raw }),
      },
    ]

    await expect(
      executeWithFallback({
        providers,
        order: ['claude'],
        request: { ...request, noFallback: true },
        runner: async () => ({ code: 0, stdout: '', stderr: '' }),
      }),
    ).rejects.toThrow('No provider succeeded')
  })
})
