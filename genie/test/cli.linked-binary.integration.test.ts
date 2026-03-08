import { afterEach, describe, expect, it } from 'vitest'

import { createCliHarness, type CliHarness } from './support/cli-harness.js'

describe('linked binary critical path integration', () => {
  const harnesses: CliHarness[] = []

  afterEach(() => {
    for (const harness of harnesses) {
      harness.cleanup()
    }
    harnesses.length = 0
  })

  function useHarness(prefix: string): CliHarness {
    const harness = createCliHarness(prefix)
    harnesses.push(harness)
    return harness
  }

  it('verifies linked genie help and provider inventory with an isolated HOME', () => {
    const harness = useHarness('linked-help')

    const help = harness.runLinkedCli(['--help'])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('Unified AI CLI for prompt execution, terminal debugging, diff review, and provider-aware automation.')

    const providers = harness.runLinkedCli(['providers', 'list', '--json'])
    expect(providers.status).toBe(0)
    expect(JSON.parse(providers.stdout)).toMatchObject({
      kind: 'providers_list',
      ok: true,
    })
  })

  it('executes a linked binary prompt flow with mocked providers and timeout handling', () => {
    const successHarness = useHarness('linked-success')
    successHarness.writeMockBinary('claude', { executionStdout: 'linked mocked response' })

    const success = successHarness.runLinkedCli(['run', '--provider', 'claude', '--no-fallback', '--plain', 'hello'])
    expect(success.status).toBe(0)
    expect(success.stdout.trim()).toBe('linked mocked response')

    const timeoutHarness = useHarness('linked-timeout')
    timeoutHarness.writeMockBinary('claude', {
      executionSh: [
        'sleep 1',
        'echo too late',
      ],
    })

    const timeout = timeoutHarness.runLinkedCli(['run', '--provider', 'claude', '--no-fallback', '--timeout-ms', '1', 'hello'])
    expect(timeout.status).toBe(124)
    expect(timeout.stderr).toContain('Timed out after 1ms')
  })
})
