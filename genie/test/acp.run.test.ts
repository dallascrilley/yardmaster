import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runViaAcp } from '../src/acp/run.js'
import { defaultConfig } from '../src/config/schema.js'
import type { AcpFallbackResult } from '../src/acp/fallback.js'

vi.mock('../src/acp/session-store.js', () => ({
   loadSession: vi.fn(),
   saveSession: vi.fn(),
}))

vi.mock('../src/acp/fallback.js', () => ({
   executeAcpFallback: vi.fn().mockResolvedValue({
      provider: 'claude',
      stopReason: 'end_turn',
      response: 'hello back',
   } satisfies AcpFallbackResult),
}))

async function getExecuteAcpFallback() {
   const mod = await import('../src/acp/fallback.js')
   return mod.executeAcpFallback as unknown as ReturnType<typeof vi.fn>
}

async function getSessionStoreMocks() {
   const mod = await import('../src/acp/session-store.js')
   return {
      loadSession: mod.loadSession as unknown as ReturnType<typeof vi.fn>,
      saveSession: mod.saveSession as unknown as ReturnType<typeof vi.fn>,
   }
}

describe('runViaAcp', () => {
   beforeEach(() => {
      vi.clearAllMocks()
   })

   it('calls executeAcpFallback and returns its result', async () => {
      const result = await runViaAcp({
         prompt: 'hello',
         config: defaultConfig,
      })

      expect(result).toMatchObject({
         provider: 'claude',
         stopReason: 'end_turn',
         response: 'hello back',
         fallbackUsed: false,
         model: null,
      })
      expect(result.timings.totalMs).toBeTypeOf('number')
   })

   it('passes resolved slots to executeAcpFallback', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({
         prompt: 'test prompt',
         config: defaultConfig,
      })

      expect(executeAcpFallback).toHaveBeenCalledOnce()
      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.slots).toBeDefined()
      expect(Array.isArray(callArgs.slots)).toBe(true)
      expect(callArgs.slots.length).toBeGreaterThan(0)
   })

   it('passes prompt and workspace to executeAcpFallback', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({
         prompt: 'do something',
         config: defaultConfig,
         workspace: '/tmp/my-workspace',
      })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.prompt).toBe('do something')
      expect(callArgs.workspace).toBe('/tmp/my-workspace')
   })

   it('defaults workspace to process.cwd() when not provided', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({ prompt: 'hello', config: defaultConfig })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.workspace).toBe(process.cwd())
   })

   it('uses config.runtime.timeoutMs as default timeout', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({ prompt: 'hello', config: defaultConfig })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.timeoutMs).toBe(defaultConfig.runtime.timeoutMs)
   })

   it('accepts an explicit timeoutMs override', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({ prompt: 'hello', config: defaultConfig, timeoutMs: 5000 })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.timeoutMs).toBe(5000)
   })

   it('sets trustMode to yolo when yolo is true', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({ prompt: 'hello', config: defaultConfig, yolo: true })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.trustMode).toBe('yolo')
   })

   it('sets trustMode to trust when trust is true', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({ prompt: 'hello', config: defaultConfig, trust: true })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.trustMode).toBe('trust')
   })

   it('sets trustMode to default when neither trust nor yolo is set', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({ prompt: 'hello', config: defaultConfig })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.trustMode).toBe('default')
   })

   it('restricts to one slot when noFallback is true', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({ prompt: 'hello', config: defaultConfig, noFallback: true })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.slots).toHaveLength(1)
   })

   it('resolves explicit provider to canonical form', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()

      await runViaAcp({ prompt: 'hello', config: defaultConfig, provider: 'claude' })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.slots[0].provider).toBe('claude')
   })

   it('preserves alias-model metadata for explicit alias providers', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()
      const previousBackend = process.env.GENIE_PI_BACKEND
      const previousModel = process.env.GENIE_PI_MODEL
      process.env.GENIE_PI_BACKEND = 'gemini'
      process.env.GENIE_PI_MODEL = 'pi-gemini-pro'

      try {
         await runViaAcp({ prompt: 'hello', config: defaultConfig, provider: 'pi' })
      } finally {
         if (previousBackend === undefined) delete process.env.GENIE_PI_BACKEND
         else process.env.GENIE_PI_BACKEND = previousBackend
         if (previousModel === undefined) delete process.env.GENIE_PI_MODEL
         else process.env.GENIE_PI_MODEL = previousModel
      }

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.slots[0]).toMatchObject({
         provider: 'gemini',
         aliasModel: 'pi-gemini-pro',
      })
   })


   it('forwards onEvent callback to fallback', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()
      const onEvent = vi.fn()

      await runViaAcp({ prompt: 'hello', config: defaultConfig, onEvent })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(typeof callArgs.onEvent).toBe('function')
   })

   it('passes mcpServers through to fallback', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()
      const mcpServers = [{ name: 'test-server' }]

      await runViaAcp({ prompt: 'hello', config: defaultConfig, mcpServers })

      const callArgs = executeAcpFallback.mock.calls[0][0]
      expect(callArgs.mcpServers).toBe(mcpServers)
   })

   it('loads and saves named sessions when a session flag is provided', async () => {
      const executeAcpFallback = await getExecuteAcpFallback()
      const { loadSession, saveSession } = await getSessionStoreMocks()
      loadSession.mockResolvedValue({
         sessionId: 'saved-session-1',
         agentCommand: '/tmp/codex-acp',
         cwd: '/tmp/workspace',
         provider: 'codex',
         createdAt: new Date().toISOString(),
         lastActiveAt: new Date().toISOString(),
      })
      executeAcpFallback.mockResolvedValueOnce({
         provider: 'codex',
         stopReason: 'end_turn',
         response: 'persist me',
         sessionId: 'saved-session-2',
      })

      await runViaAcp({
         prompt: 'resume this',
         config: defaultConfig,
         workspace: '/tmp/workspace',
         session: 'demo',
         provider: 'codex',
      })

      expect(loadSession).toHaveBeenCalledWith('demo')
      expect(executeAcpFallback.mock.calls[0]?.[0].existingSessionId).toBe('saved-session-1')
      expect(saveSession).toHaveBeenCalledWith(
         'demo',
         expect.objectContaining({
            sessionId: 'saved-session-2',
            provider: 'codex',
            cwd: '/tmp/workspace',
         }),
      )
   })
})
