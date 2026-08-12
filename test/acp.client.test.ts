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
      const child = makeFakeChild()
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
      const child = makeFakeChild()
         ; (client as any).child = child

      client.close()
      child.emitExit()
      vi.advanceTimersByTime(3000)
      expect(child.kill).toHaveBeenCalledTimes(1)
      expect(child.kill).toHaveBeenCalledWith('SIGTERM')
   })

   // Regression: the CLI printed its result envelope and then hung forever.
   // `ndJsonStream` holds `child.stdout` behind a web-stream reader that is
   // never cancelled, so the pipe never reaches EOF and its handle keeps the
   // event loop alive after the child is gone. `src/cli.ts` only sets
   // `process.exitCode`, so a referenced handle means the process never exits.
   it('destroys the child stdio pipes once the child exits', () => {
      vi.useFakeTimers()
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      const child = makeFakeChild()
         ; (client as any).child = child

      client.close()
      expect(child.stdout.destroy).not.toHaveBeenCalled()

      child.emitExit()

      expect(child.stdin.destroy).toHaveBeenCalled()
      expect(child.stdout.destroy).toHaveBeenCalled()
      expect(child.stderr.destroy).toHaveBeenCalled()
   })

   it('destroys the stdio pipes without re-signalling a child that already exited', () => {
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      const child = makeFakeChild({ exitCode: 0 })
         ; (client as any).child = child

      client.close()

      expect(child.kill).not.toHaveBeenCalled()
      expect(child.stdout.destroy).toHaveBeenCalled()
   })

   // A signal-killed child reports `exitCode === null` forever and carries the
   // signal in `signalCode`, so `exitCode` alone cannot detect "already gone".
   it('treats a signal-killed child as already exited', () => {
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      const child = makeFakeChild({ signalCode: 'SIGTERM' })
         ; (client as any).child = child

      client.close()

      expect(child.kill).not.toHaveBeenCalled()
      expect(child.stdout.destroy).toHaveBeenCalled()
   })

   // A failed spawn never emits `exit`, and Bun leaves both exitCode and
   // signalCode null there. Arming the escalation timer would then stall the
   // CLI for the full escalation deadline on every provider it tries.
   it('arms no escalation timer for a child that never started', () => {
      vi.useFakeTimers()
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      const child = makeFakeChild({ pid: undefined })
         ; (client as any).child = child

      client.close()

      expect(vi.getTimerCount()).toBe(0)
      expect(child.kill).not.toHaveBeenCalled()
      expect(child.stdout.destroy).toHaveBeenCalled()
   })

   // The live child's own handle keeps the loop open, so an unref'd timer still
   // fires; unref keeps it from being what holds the CLI open.
   it('leaves the escalation timer unref\'d', () => {
      vi.useFakeTimers()
      const entry = makeEntry()
      const { options } = makeOptions()
      const client = new AcpClient(entry, options)
      const child = makeFakeChild()
         ; (client as any).child = child
      const unref = vi.fn()
      const setTimeoutSpy = vi
         .spyOn(globalThis, 'setTimeout')
         .mockReturnValue({ unref } as unknown as ReturnType<typeof setTimeout>)

      client.close()

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000)
      expect(unref).toHaveBeenCalled()
   })
})

function makeFakeStream() {
   return { destroy: vi.fn() }
}

function makeFakeChild(
   overrides: { exitCode?: number | null; signalCode?: string | null; pid?: number | undefined } = {},
) {
   let onExit: (() => void) | undefined
   return {
      exitCode: overrides.exitCode ?? null,
      signalCode: overrides.signalCode ?? null,
      pid: 'pid' in overrides ? overrides.pid : 4242,
      stdin: makeFakeStream(),
      stdout: makeFakeStream(),
      stderr: makeFakeStream(),
      kill: vi.fn(),
      once: vi.fn((event: string, handler: () => void) => {
         if (event === 'exit') onExit = handler
      }),
      removeListener: vi.fn(),
      emitExit: (): void => onExit?.(),
   }
}
