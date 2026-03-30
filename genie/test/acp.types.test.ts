import { describe, expectTypeOf, it } from 'vitest'

import type { AcpProviderEntry, PlanEntry, SessionHandle, StreamEvent } from '../src/acp/types.js'
import type { ProviderId } from '../src/types.js'

describe('ACP types', () => {
  describe('AcpProviderEntry', () => {
    it('has the required shape with all fields', () => {
      const entry: AcpProviderEntry = {
        id: 'claude',
        agentCommand: 'claude',
        args: ['--no-update-check'],
        resolveEnv: () => ({ ANTHROPIC_API_KEY: 'key' }),
        authCheck: async () => true,
      }
      expectTypeOf(entry.id).toMatchTypeOf<ProviderId>()
      expectTypeOf(entry.agentCommand).toBeString()
      expectTypeOf(entry.args).toMatchTypeOf<readonly string[] | undefined>()
    })

    it('is valid with only required fields', () => {
      const entry: AcpProviderEntry = {
        id: 'gemini',
        agentCommand: 'gemini',
      }
      expectTypeOf(entry.id).toMatchTypeOf<ProviderId>()
    })

    it('resolveEnv returns a string record', () => {
      const entry: AcpProviderEntry = {
        id: 'codex',
        agentCommand: 'codex',
        resolveEnv: () => ({ FOO: 'bar' }),
      }
      expectTypeOf(entry.resolveEnv).toMatchTypeOf<(() => Record<string, string>) | undefined>()
    })

    it('authCheck returns a Promise<boolean>', () => {
      const entry: AcpProviderEntry = {
        id: 'cursor-agent',
        agentCommand: 'cursor-agent',
        authCheck: async () => false,
      }
      expectTypeOf(entry.authCheck).toMatchTypeOf<(() => Promise<boolean>) | undefined>()
    })
  })

  describe('SessionHandle', () => {
    it('has the required shape', () => {
      const handle: SessionHandle = {
        sessionId: 'abc-123',
        provider: 'claude',
        agentCommand: 'claude',
        cwd: '/workspace',
      }
      expectTypeOf(handle.sessionId).toBeString()
      expectTypeOf(handle.provider).toMatchTypeOf<ProviderId>()
      expectTypeOf(handle.agentCommand).toBeString()
      expectTypeOf(handle.cwd).toBeString()
    })
  })

  describe('PlanEntry', () => {
    it('has the required shape with all fields', () => {
      const entry: PlanEntry = {
        content: 'Do the thing',
        status: 'pending',
        priority: 'high',
      }
      expectTypeOf(entry.content).toBeString()
      expectTypeOf(entry.status).toMatchTypeOf<'pending' | 'in_progress' | 'completed'>()
      expectTypeOf(entry.priority).toMatchTypeOf<'high' | 'medium' | 'low' | undefined>()
    })

    it('is valid without optional priority', () => {
      const entry: PlanEntry = {
        content: 'Another task',
        status: 'completed',
      }
      expectTypeOf(entry.status).toMatchTypeOf<'pending' | 'in_progress' | 'completed'>()
    })
  })

  describe('StreamEvent', () => {
    it('content event has text', () => {
      const event: StreamEvent = { kind: 'content', text: 'hello' }
      if (event.kind === 'content') {
        expectTypeOf(event.text).toBeString()
      }
    })

    it('tool-call event has name and params', () => {
      const event: StreamEvent = { kind: 'tool-call', name: 'read_file', params: '{}' }
      if (event.kind === 'tool-call') {
        expectTypeOf(event.name).toBeString()
        expectTypeOf(event.params).toBeString()
      }
    })

    it('tool-result event has name and result', () => {
      const event: StreamEvent = { kind: 'tool-result', name: 'read_file', result: 'contents' }
      if (event.kind === 'tool-result') {
        expectTypeOf(event.name).toBeString()
        expectTypeOf(event.result).toBeString()
      }
    })

    it('plan event has readonly entries array of PlanEntry', () => {
      const event: StreamEvent = {
        kind: 'plan',
        entries: [{ content: 'task 1', status: 'pending' }],
      }
      if (event.kind === 'plan') {
        expectTypeOf(event.entries).toMatchTypeOf<readonly PlanEntry[]>()
      }
    })

    it('done event has stopReason', () => {
      const event: StreamEvent = { kind: 'done', stopReason: 'end_turn' }
      if (event.kind === 'done') {
        expectTypeOf(event.stopReason).toBeString()
      }
    })

    it('exhaustive switch compiles with never default', () => {
      const event: StreamEvent = { kind: 'content', text: 'x' }
      const handle = (e: StreamEvent): string => {
        switch (e.kind) {
          case 'content':
            return e.text
          case 'tool-call':
            return e.name
          case 'tool-result':
            return e.result
          case 'plan':
            return e.entries.length.toString()
          case 'done':
            return e.stopReason
          default: {
            const _exhaustive: never = e
            return _exhaustive
          }
        }
      }
      expectTypeOf(handle).toMatchTypeOf<(e: StreamEvent) => string>()
    })
  })
})
