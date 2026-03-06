import { describe, expect, it } from 'vitest'

import { AggregatedProviderError, UsageError, formatCliError } from '../src/errors.js'

describe('cli error formatting', () => {
  it('adds next steps for unknown commands', () => {
    const formatted = formatCliError(new UsageError("Unknown command 'gleep'. Use 'genie help' for usage."))

    expect(formatted).toContain("Unknown command 'gleep'. Use 'genie help' for usage.")
    expect(formatted).toContain('Next steps:')
    expect(formatted).toContain('Run `genie help` to see the available commands.')
  })

  it('adds review-specific next steps for target selection errors', () => {
    const formatted = formatCliError(new UsageError('A review target is required. Use --all or --agent <codex|claude|gemini|cursor>.'))

    expect(formatted).toContain('Choose exactly one target')
    expect(formatted).toContain('Run `genie help review`')
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
    expect(formatted).toContain('Run `genie providers doctor`')
    expect(formatted).toContain('Retry with `genie run --provider <id> --no-fallback "<prompt>"`')
  })
})
