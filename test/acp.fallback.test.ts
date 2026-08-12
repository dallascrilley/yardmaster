import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AggregatedProviderError, AcpProtocolError, TimeoutError } from '../src/errors.js'
import type { StreamEvent } from '../src/acp/types.js'

const mockRun = vi.fn<(...args: any[]) => Promise<string>>()
const mockClose = vi.fn<(...args: any[]) => void>()
const mockGetSessionId = vi.fn<(...args: any[]) => string | null>().mockReturnValue('mock-session-id')
const mockResume = vi.fn<(...args: any[]) => Promise<boolean>>().mockResolvedValue(false)
const mockPrompt = vi.fn<(...args: any[]) => Promise<string>>()

vi.mock('../src/acp/client.js', () => ({
   AcpClient: vi.fn().mockImplementation(function MockAcpClient() {
      return {
         run: mockRun,
         close: mockClose,
         getSessionId: mockGetSessionId,
         resume: mockResume,
         prompt: mockPrompt,
      }
   }),
}))

vi.mock('../src/acp/provider-registry.js', () => ({
   getAcpProvider: vi.fn(),
}))

import { AcpClient } from '../src/acp/client.js'
import { getAcpProvider } from '../src/acp/provider-registry.js'
import { executeAcpFallback } from '../src/acp/fallback.js'
import type { AcpProviderEntry } from '../src/acp/types.js'

const MockedAcpClient = AcpClient as unknown as ReturnType<typeof vi.fn>
const mockGetAcpProvider = getAcpProvider as unknown as ReturnType<typeof vi.fn>

type SlotInput = { provider: string; aliasModel?: string }

function makeEntry(id: string, overrides: Partial<AcpProviderEntry> = {}): AcpProviderEntry {
   return {
      id: id as AcpProviderEntry['id'],
      agentCommand: 'echo',
      ...overrides,
   }
}

function makeParams(slots: SlotInput[], overrides = {}) {
   const events: StreamEvent[] = []
   return {
      params: {
         slots: slots as Parameters<typeof executeAcpFallback>[0]['slots'],
         prompt: 'test prompt',
         workspace: '/tmp',
         trustMode: 'trust' as const,
         timeoutMs: 5000,
         onEvent: (event: StreamEvent) => events.push(event),
         ...overrides,
      },
      events,
   }
}

beforeEach(() => {
   vi.clearAllMocks()
   mockGetSessionId.mockReturnValue('mock-session-id')
   mockResume.mockResolvedValue(false)
})

describe('executeAcpFallback', () => {
   it('returns result from first available provider', async () => {
      const entry = makeEntry('claude')
      mockGetAcpProvider.mockReturnValue(entry)
      mockRun.mockResolvedValue('end_turn')

      const { params } = makeParams([{ provider: 'claude' }])
      const result = await executeAcpFallback(params)

      expect(result.provider).toBe('claude')
      expect(result.stopReason).toBe('end_turn')
      expect(mockRun).toHaveBeenCalledOnce()
      expect(mockRun).toHaveBeenCalledWith('test prompt')
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
      mockRun.mockImplementation(async () => {
         callCount += 1
         if (callCount === 1) throw new Error('claude exploded')
         return 'end_turn'
      })

      const { params } = makeParams([{ provider: 'claude' }, { provider: 'codex' }])
      const result = await executeAcpFallback(params)

      expect(result.provider).toBe('codex')
      expect(result.stopReason).toBe('end_turn')
      expect(mockRun).toHaveBeenCalledTimes(2)
   })

   it('throws AggregatedProviderError when all providers fail', async () => {
      const entry = makeEntry('claude')
      mockGetAcpProvider.mockReturnValue(entry)
      mockRun.mockRejectedValue(new Error('always fails'))

      const { params } = makeParams([{ provider: 'claude' }, { provider: 'codex' }])
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
      mockRun.mockImplementation(async () => {
         callCount += 1
         throw callCount === 1 ? err1 : err2
      })

      const { params } = makeParams([{ provider: 'claude' }, { provider: 'codex' }])
      const thrown = await executeAcpFallback(params).catch((error) => error)

      expect(thrown).toBeInstanceOf(AggregatedProviderError)
      expect(thrown.reasons).toHaveLength(2)
      expect(thrown.reasons[0]).toMatchObject({ provider: 'claude', stage: 'execution', reason: 'claude failed' })
      expect(thrown.reasons[1]).toMatchObject({ provider: 'codex', stage: 'execution', reason: 'codex failed' })
   })

   it('skips providers without a registered ACP adapter (e.g. cursor-agent)', async () => {
      const codexEntry = makeEntry('codex')
      mockGetAcpProvider.mockImplementation((id) => {
         if (id === 'codex') return codexEntry
         return undefined
      })
      mockRun.mockResolvedValue('end_turn')

      const { params } = makeParams([{ provider: 'cursor-agent' }, { provider: 'codex' }])
      const result = await executeAcpFallback(params)

      expect(result.provider).toBe('codex')
      expect(mockRun).toHaveBeenCalledOnce()
   })

   it('records missing-adapter failures with stage availability', async () => {
      mockGetAcpProvider.mockReturnValue(undefined)

      const { params } = makeParams([{ provider: 'cursor-agent' }])
      const thrown = await executeAcpFallback(params).catch((error) => error)

      expect(thrown).toBeInstanceOf(AggregatedProviderError)
      expect(thrown.reasons[0]).toMatchObject({
         provider: 'cursor-agent',
         stage: 'availability',
      })
   })

   it('classifies AcpProtocolError code -32000 as auth stage', async () => {
      const entry = makeEntry('claude')
      mockGetAcpProvider.mockReturnValue(entry)
      mockRun.mockRejectedValue(new AcpProtocolError(-32000, 'auth required', 'claude'))

      const { params } = makeParams([{ provider: 'claude' }])
      const thrown = await executeAcpFallback(params).catch((error) => error)

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
      mockRun.mockRejectedValue(new TimeoutError('timed out'))

      const { params } = makeParams([{ provider: 'gemini' }])
      const thrown = await executeAcpFallback(params).catch((error) => error)

      expect(thrown).toBeInstanceOf(AggregatedProviderError)
      expect(thrown.reasons[0]).toMatchObject({
         provider: 'gemini',
         stage: 'execution',
         timeout: true,
      })
   })

   it('uses slot aliasModel when no explicit model override is provided', async () => {
      const entry = makeEntry('gemini')
      mockGetAcpProvider.mockReturnValue(entry)
      mockRun.mockResolvedValue('end_turn')

      const { params } = makeParams([{ provider: 'gemini', aliasModel: 'pi-gemini-pro' }])
      await executeAcpFallback(params)

      expect(MockedAcpClient).toHaveBeenCalledWith(
         entry,
         expect.objectContaining({ model: 'pi-gemini-pro' }),
      )
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
      mockRun.mockResolvedValue('end_turn')

      const { params } = makeParams([{ provider: 'claude' }, { provider: 'codex' }])
      const result = await executeAcpFallback(params)

      expect(result.provider).toBe('codex')
      expect(mockRun).toHaveBeenCalledOnce()
   })

   it('records authCheck failure with authFailure: true', async () => {
      const entry = makeEntry('claude', { authCheck: async () => false })
      mockGetAcpProvider.mockReturnValue(entry)

      const { params } = makeParams([{ provider: 'claude' }])
      const thrown = await executeAcpFallback(params).catch((error) => error)

      expect(thrown).toBeInstanceOf(AggregatedProviderError)
      expect(thrown.reasons[0]).toMatchObject({
         provider: 'claude',
         stage: 'auth',
         authFailure: true,
      })
      expect(mockRun).not.toHaveBeenCalled()
   })
})
