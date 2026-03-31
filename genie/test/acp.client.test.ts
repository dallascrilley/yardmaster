import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequestError } from '@agentclientprotocol/sdk'
import { AcpClient } from '../src/acp/client.js'
import { ACP_AUTH_ERROR_CODE, AcpProtocolError, RuntimeProviderError } from '../src/errors.js'
import type { AcpProviderEntry, StreamEvent } from '../src/acp/types.js'

function makeEntry(overrides: Partial<AcpProviderEntry> = {}): AcpProviderEntry {
   return {
      id: 'test-provider' as AcpProviderEntry['id'],
      agentCommand: 'echo',
      args: ['hello'],
      ...overrides,
   }
}

function makeOptions(overrides: Partial<ConstructorParameters<typeof AcpClient>[1]> = {}) {
   const events: StreamEvent[] = []
   return {
      options: {
         workspace: '/tmp',
         trustMode: 'trust' as const,
         timeoutMs: 5000,
         onEvent: (event: StreamEvent) => events.push(event),
         ...overrides,
      },
      events,
   }
}

describe('AcpProtocolError wrapping', () => {
   it('AcpProtocolError carries the SDK error code and provider id', () => {
      const sdkErr = new RequestError(ACP_AUTH_ERROR_CODE, 'Authentication required')
      const wrapped = new AcpProtocolError(sdkErr.code, sdkErr.message, 'my-provider')
      expect(wrapped).toBeInstanceOf(AcpProtocolError)
      expect(wrapped.code).toBe(ACP_AUTH_ERROR_CODE)
      expect(wrapped.providerId).toBe('my-provider')
      expect(wrapped.message).toContain('Authentication required')
   })
})

describe('AcpClient', () => {
   afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
   })

   it('constructs without throwing', () => {
      const entry = makeEntry()
      const { options } = makeOptions()
      expect(() => new AcpClient(entry, options)).not.toThrow()
   })

   it('close() on an unstarted client does not throw', () => {
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      expect(() => client.close()).not.toThrow()
   })

   it('throws RuntimeProviderError when the binary does not exist', async () => {
      const entry = makeEntry({ agentCommand: '/nonexistent/binary/that/does/not/exist' })
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      await expect(client.run('hello')).rejects.toBeInstanceOf(RuntimeProviderError)
   })

   it('normalizes raw ACP protocol failures from prompt()', async () => {
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      const sendPromptSpy = vi.spyOn(client as any, 'sendPrompt').mockRejectedValue({
         code: ACP_AUTH_ERROR_CODE,
         message: 'login required',
      })

      await expect(client.prompt('hello')).rejects.toMatchObject({
         code: ACP_AUTH_ERROR_CODE,
         providerId: 'test-provider',
      })

      sendPromptSpy.mockRestore()
   })

   it('clears the prompt timeout once the prompt resolves', async () => {
      vi.useFakeTimers()
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
         ; (client as any).connection = {
            prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
         }
         ; (client as any).sessionId = 'session-1'

      await expect((client as any).sendPrompt('hello')).resolves.toBe('end_turn')
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
   })

   it('escalates to SIGKILL if the child does not exit after SIGTERM', () => {
      vi.useFakeTimers()
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      const child = {
         exitCode: null,
         kill: vi.fn(),
         once: vi.fn(),
         removeListener: vi.fn(),
      }
         ; (client as any).child = child

      client.close()
      expect(child.kill).toHaveBeenCalledWith('SIGTERM')
      vi.advanceTimersByTime(3000)
      expect(child.kill).toHaveBeenCalledWith('SIGKILL')
   })

   it('cancels escalation when the child exits before the deadline', () => {
      vi.useFakeTimers()
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      let onExit: (() => void) | undefined
      const child = {
         exitCode: null,
         kill: vi.fn(),
         once: vi.fn((event: string, handler: () => void) => {
            if (event === 'exit') onExit = handler
         }),
         removeListener: vi.fn(),
      }
         ; (client as any).child = child

      client.close()
      onExit?.()
      vi.advanceTimersByTime(3000)
      expect(child.kill).toHaveBeenCalledTimes(1)
      expect(child.kill).toHaveBeenCalledWith('SIGTERM')
   })
})
