import { describe, expect, it } from 'vitest'

import { AcpProtocolError, AggregatedProviderError, UsageError, formatCliError, getExitCode } from '../src/errors.js'

describe('cli error formatting', () => {
  it('adds next steps for unknown commands', () => {
    const formatted = formatCliError(new UsageError("Unknown command 'gleep'. Use 'yardmaster help' for usage."))

    expect(formatted).toContain("Unknown command 'gleep'. Use 'yardmaster help' for usage.")
    expect(formatted).toContain('Next steps:')
    expect(formatted).toContain('Run `yardmaster help` to see the available commands.')
  })

  it('adds review-specific next steps for target selection errors', () => {
    const formatted = formatCliError(new UsageError('A review target is required. Use --all or --agent <codex|claude|gemini|cursor>.'))

    expect(formatted).toContain('Choose exactly one target')
    expect(formatted).toContain('Run `yardmaster help review`')
  })

  it('adds provider recovery guidance for aggregated provider failures', () => {
    const formatted = formatCliError(
      new AggregatedProviderError([
        {
          provider: 'codex',
          stage: 'auth',
          reason: 'login required',
          hint: 'Run codex login.',
          authFailure: true,
        },
      ]),
    )

    expect(formatted).toContain('All providers failed.')
    expect(formatted).toContain('Run `yardmaster providers doctor`')
    expect(formatted).toContain('Retry with `yardmaster run --provider <id> --no-fallback "<prompt>"`')
  })
})

describe('AcpProtocolError', () => {
  it('wraps JSON-RPC error code', () => {
    const err = new AcpProtocolError(-32000, 'Auth required', 'claude')
    expect(err.code).toBe(-32000)
    expect(err.providerId).toBe('claude')
    expect(err.message).toContain('Auth required')
  })

  it('maps -32000 to exit code 3 (auth)', () => {
    const err = new AcpProtocolError(-32000, 'Auth required', 'claude')
    expect(getExitCode(err)).toBe(3)
  })

  it('maps -32603 to exit code 1 (runtime)', () => {
    const err = new AcpProtocolError(-32603, 'Internal error', 'codex')
    expect(getExitCode(err)).toBe(1)
  })

  it('formats with next steps', () => {
    const err = new AcpProtocolError(-32000, 'Auth required', 'claude')
    const formatted = formatCliError(err)
    expect(formatted).toContain('ACP protocol error')
    expect(formatted).toContain('yardmaster providers doctor')
  })
})
