import { describe, expect, it } from 'vitest'
import { AcpClient } from '../src/acp/client.js'
import { RuntimeProviderError } from '../src/errors.js'
import type { AcpProviderEntry } from '../src/acp/types.js'
import type { StreamEvent } from '../src/acp/types.js'

function makeEntry(overrides: Partial<AcpProviderEntry> = {}): AcpProviderEntry {
  return {
    id: 'test-provider' as AcpProviderEntry['id'],
    agentCommand: 'echo',
    args: ['hello'],
    ...overrides,
  }
}

function makeOptions(overrides: Partial<Parameters<typeof AcpClient.prototype.run>[0]> = {}) {
  const events: StreamEvent[] = []
  return {
    options: {
      workspace: '/tmp',
      trustMode: 'trust' as const,
      timeoutMs: 5000,
      onEvent: (e: StreamEvent) => events.push(e),
    },
    events,
    ...overrides,
  }
}

describe('AcpClient', () => {
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
})
