import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AggregatedProviderError, AcpProtocolError, TimeoutError } from '../src/errors.js'
import type { StreamEvent } from '../src/acp/types.js'

// Mock client module before importing the module under test
vi.mock('../src/acp/client.js', () => {
  const AcpClient = vi.fn()
  AcpClient.prototype.run = vi.fn()
  AcpClient.prototype.close = vi.fn()
  return { AcpClient }
})

// Mock registry so we control which providers are "registered"
vi.mock('../src/acp/provider-registry.js', () => ({
  getAcpProvider: vi.fn(),
}))

import { AcpClient } from '../src/acp/client.js'
import { getAcpProvider } from '../src/acp/provider-registry.js'
import { executeAcpFallback } from '../src/acp/fallback.js'
import type { AcpProviderEntry } from '../src/acp/types.js'

const MockedAcpClient = vi.mocked(AcpClient)
const mockGetAcpProvider = vi.mocked(getAcpProvider)

function makeEntry(id: string, overrides: Partial<AcpProviderEntry> = {}): AcpProviderEntry {
  return {
    id: id as AcpProviderEntry['id'],
    agentCommand: 'echo',
    ...overrides,
  }
}

function makeParams(slots: { provider: string; aliasModel?: string }[], overrides = {}) {
  const events: StreamEvent[] = []
  return {
    params: {
      slots: slots as Parameters<typeof executeAcpFallback>[0]['slots'],
      prompt: 'test prompt',
      workspace: '/tmp',
      trustMode: 'trust' as const,
      timeoutMs: 5000,
      onEvent: (e: StreamEvent) => events.push(e),
    },
    events,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('executeAcpFallback', () => {
  it('returns result from first available provider', async () => {
    const entry = makeEntry('claude')
    mockGetAcpProvider.mockReturnValue(entry)
    MockedAcpClient.prototype.run.mockResolvedValue('end_turn')

    const { params } = makeParams([{ provider: 'claude' }])
    const result = await executeAcpFallback(params)

    expect(result.provider).toBe('claude')
    expect(result.stopReason).toBe('end_turn')
    expect(MockedAcpClient.prototype.run).toHaveBeenCalledOnce()
    expect(MockedAcpClient.prototype.run).toHaveBeenCalledWith('test prompt')
  })

  it('falls through to the next provider when the first fails', async () => {
    const claudeEntry = makeEntry('claude')
    const codexEntry = makeEntry('codex')

    mockGetAcpProvider.mockImplementation((id) => {
      if (id === 'claude') return claudeEntry
      if (id === 'codex') return codexEntry
      return undefined
    })

    let callCount = 0
    MockedAcpClient.prototype.run.mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('claude exploded')
      return 'end_turn'
    })

    const { params } = makeParams([{ provider: 'claude' }, { provider: 'codex' }])
    const result = await executeAcpFallback(params)

    expect(result.provider).toBe('codex')
    expect(result.stopReason).toBe('end_turn')
    expect(MockedAcpClient.prototype.run).toHaveBeenCalledTimes(2)
  })

  it('throws AggregatedProviderError when all providers fail', async () => {
    const entry = makeEntry('claude')
    mockGetAcpProvider.mockReturnValue(entry)
    MockedAcpClient.prototype.run.mockRejectedValue(new Error('always fails'))

    const { params } = makeParams([{ provider: 'claude' }, { provider: 'codex' }])

    // codex entry is also returned by the mock (same entry, different id doesn't matter here)
    await expect(executeAcpFallback(params)).rejects.toBeInstanceOf(AggregatedProviderError)
  })

  it('includes all failure reasons in AggregatedProviderError', async () => {
    const claudeEntry = makeEntry('claude')
    const codexEntry = makeEntry('codex')

    mockGetAcpProvider.mockImplementation((id) => {
      if (id === 'claude') return claudeEntry
      if (id === 'codex') return codexEntry
      return undefined
    })

    const err1 = new Error('claude failed')
    const err2 = new Error('codex failed')
    let callCount = 0
    MockedAcpClient.prototype.run.mockImplementation(async () => {
      callCount++
      throw callCount === 1 ? err1 : err2
    })

    const { params } = makeParams([{ provider: 'claude' }, { provider: 'codex' }])
    const thrown = await executeAcpFallback(params).catch((e) => e)

    expect(thrown).toBeInstanceOf(AggregatedProviderError)
    expect(thrown.reasons).toHaveLength(2)
    expect(thrown.reasons[0]).toMatchObject({ provider: 'claude', stage: 'execution', reason: 'claude failed' })
    expect(thrown.reasons[1]).toMatchObject({ provider: 'codex', stage: 'execution', reason: 'codex failed' })
  })

  it('skips providers without a registered ACP adapter (e.g. cursor-agent)', async () => {
    const codexEntry = makeEntry('codex')
    mockGetAcpProvider.mockImplementation((id) => {
      if (id === 'codex') return codexEntry
      return undefined // cursor-agent not registered
    })
    MockedAcpClient.prototype.run.mockResolvedValue('end_turn')

    const { params } = makeParams([{ provider: 'cursor-agent' }, { provider: 'codex' }])
    const result = await executeAcpFallback(params)

    expect(result.provider).toBe('codex')
    expect(MockedAcpClient.prototype.run).toHaveBeenCalledOnce()
  })

  it('records missing-adapter failures with stage availability', async () => {
    mockGetAcpProvider.mockReturnValue(undefined)

    const { params } = makeParams([{ provider: 'cursor-agent' }])
    const thrown = await executeAcpFallback(params).catch((e) => e)

    expect(thrown).toBeInstanceOf(AggregatedProviderError)
    expect(thrown.reasons[0]).toMatchObject({
      provider: 'cursor-agent',
      stage: 'availability',
    })
  })

  it('classifies AcpProtocolError code -32000 as auth stage', async () => {
    const entry = makeEntry('claude')
    mockGetAcpProvider.mockReturnValue(entry)
    MockedAcpClient.prototype.run.mockRejectedValue(new AcpProtocolError(-32000, 'auth required', 'claude'))

    const { params } = makeParams([{ provider: 'claude' }])
    const thrown = await executeAcpFallback(params).catch((e) => e)

    expect(thrown).toBeInstanceOf(AggregatedProviderError)
    expect(thrown.reasons[0]).toMatchObject({
      provider: 'claude',
      stage: 'auth',
      authFailure: true,
    })
  })

  it('marks TimeoutError failures with timeout: true', async () => {
    const entry = makeEntry('gemini')
    mockGetAcpProvider.mockReturnValue(entry)
    MockedAcpClient.prototype.run.mockRejectedValue(new TimeoutError('timed out'))

    const { params } = makeParams([{ provider: 'gemini' }])
    const thrown = await executeAcpFallback(params).catch((e) => e)

    expect(thrown).toBeInstanceOf(AggregatedProviderError)
    expect(thrown.reasons[0]).toMatchObject({
      provider: 'gemini',
      stage: 'execution',
      timeout: true,
    })
  })

  it('skips a provider when authCheck returns false', async () => {
    const codexEntry = makeEntry('codex')
    const claudeEntry = makeEntry('claude', {
      authCheck: async () => false,
    })

    mockGetAcpProvider.mockImplementation((id) => {
      if (id === 'claude') return claudeEntry
      if (id === 'codex') return codexEntry
      return undefined
    })
    MockedAcpClient.prototype.run.mockResolvedValue('end_turn')

    const { params } = makeParams([{ provider: 'claude' }, { provider: 'codex' }])
    const result = await executeAcpFallback(params)

    expect(result.provider).toBe('codex')
    // run() should only be called for codex, not claude
    expect(MockedAcpClient.prototype.run).toHaveBeenCalledOnce()
  })

  it('records authCheck failure with authFailure: true', async () => {
    const entry = makeEntry('claude', { authCheck: async () => false })
    mockGetAcpProvider.mockReturnValue(entry)

    const { params } = makeParams([{ provider: 'claude' }])
    const thrown = await executeAcpFallback(params).catch((e) => e)

    expect(thrown).toBeInstanceOf(AggregatedProviderError)
    expect(thrown.reasons[0]).toMatchObject({
      provider: 'claude',
      stage: 'auth',
      authFailure: true,
    })
    expect(MockedAcpClient.prototype.run).not.toHaveBeenCalled()
  })
})
