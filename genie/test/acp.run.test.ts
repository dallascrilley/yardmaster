import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runViaAcp } from '../src/acp/run.js'
import { defaultConfig } from '../src/config/schema.js'
import type { AcpFallbackResult } from '../src/acp/fallback.js'

vi.mock('../src/acp/fallback.js', () => ({
  executeAcpFallback: vi.fn().mockResolvedValue({
    provider: 'claude',
    stopReason: 'end_turn',
  } satisfies AcpFallbackResult),
}))

async function getExecuteAcpFallback() {
  const mod = await import('../src/acp/fallback.js')
  return vi.mocked(mod.executeAcpFallback)
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

    expect(result).toEqual({ provider: 'claude', stopReason: 'end_turn' })
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
})
