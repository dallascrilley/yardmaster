import { describe, it, expect, vi } from 'vitest'
import { AcpClient } from '../src/acp/client.js'
import type { AcpProviderEntry } from '../src/acp/types.js'
import type { ProviderId } from '../src/types.js'

// Mock the SDK
vi.mock('@agentclientprotocol/sdk', async () => {
  const actual = await vi.importActual('@agentclientprotocol/sdk')
  return {
    ...actual,
    ClientSideConnection: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue({
        protocolVersion: '2025-03-11',
        agentCapabilities: {},
        agentInfo: { name: 'test-agent', version: '0.1.0' },
      }),
      newSession: vi.fn().mockResolvedValue({ sessionId: 'new-session-123' }),
      loadSession: vi.fn().mockResolvedValue({ sessionId: 'existing-session-456' }),
      prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    })),
    ndJsonStream: vi.fn().mockReturnValue({}),
    PROTOCOL_VERSION: '2025-03-11',
  }
})

describe('AcpClient session resume', () => {
  const mockEntry: AcpProviderEntry = {
    id: 'claude' as ProviderId,
    agentCommand: 'echo',
    args: ['test'],
  }

  const makeClient = () =>
    new AcpClient(mockEntry, {
      workspace: '/tmp',
      trustMode: 'trust',
      timeoutMs: 5000,
      onEvent: () => {},
    })

  it('getSessionId returns null before session creation', () => {
    const client = makeClient()
    expect(client.getSessionId()).toBeNull()
  })

  it('resume returns true when loadSession succeeds', async () => {
    const client = makeClient()
    const result = await client.resume('existing-session-456')
    expect(result).toBe(true)
    expect(client.getSessionId()).toBe('existing-session-456')
  })

  it('resume returns false and creates new session when loadSession fails', async () => {
    const { ClientSideConnection } = await import('@agentclientprotocol/sdk')
    vi.mocked(ClientSideConnection).mockImplementationOnce(
      () =>
        ({
          initialize: vi.fn().mockResolvedValue({
            protocolVersion: '2025-03-11',
            agentCapabilities: {},
            agentInfo: { name: 'test-agent', version: '0.1.0' },
          }),
          newSession: vi.fn().mockResolvedValue({ sessionId: 'fallback-session' }),
          loadSession: vi.fn().mockRejectedValue(new Error('Session not found')),
          prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
        }) as unknown as typeof ClientSideConnection,
    )

    const client = makeClient()
    const result = await client.resume('non-existent-session')
    expect(result).toBe(false)
    expect(client.getSessionId()).toBe('fallback-session')
  })
})
