import { describe, expect, it } from 'vitest'

import { AggregatedProviderError } from '../src/errors.js'
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

describe('fallback execution', () => {
  it('tries providers in order and returns first successful result', async () => {
    const providers: ProviderAdapter[] = [
      {
        id: 'claude',
        isAvailable: async () => ({ ok: true }),
        isAuthenticated: async () => ({ ok: false, reason: 'auth required', hint: 'log in' }),
        buildInvocation: () => ({ command: 'claude', args: [] }),
        execute: async () => {
          throw new Error('should not execute')
        },
        parse: ({ stdout }) => ({ text: stdout, raw: { code: 0, stdout, stderr: '' } }),
      },
      {
        id: 'codex',
        isAvailable: async () => ({ ok: true }),
        isAuthenticated: async () => ({ ok: true }),
        buildInvocation: () => ({ command: 'codex', args: [] }),
        execute: async () => ({ text: 'ok', raw: { code: 0, stdout: 'ok', stderr: '' } }),
        parse: ({ stdout }) => ({ text: stdout, raw: { code: 0, stdout, stderr: '' } }),
      },
    ]

    const result = await executeWithFallback({
      providers,
      order: ['claude', 'codex'],
      request,
      runner: async () => ({ code: 0, stdout: '', stderr: '' }),
    })

    expect(result.provider.id).toBe('codex')
    expect(result.result.response).toBe('ok')
  })

  it('throws aggregated error when all providers fail', async () => {
    const providers: ProviderAdapter[] = [
      {
        id: 'claude',
        isAvailable: async () => ({ ok: false, reason: 'missing', hint: 'install' }),
        isAuthenticated: async () => ({ ok: false, reason: 'noauth', hint: 'sign in' }),
        buildInvocation: () => ({ command: 'claude', args: [] }),
        execute: async () => ({ text: '', raw: { code: 1, stdout: '', stderr: '' } }),
        parse: ({ stdout }) => ({ text: stdout, raw: { code: 0, stdout, stderr: '' } }),
      },
    ]

    await expect(() =>
      executeWithFallback({
        providers,
        order: ['claude'],
        request,
        runner: async () => ({ code: 0, stdout: '', stderr: '' }),
      }),
    ).rejects.toBeInstanceOf(AggregatedProviderError)
  })
})
