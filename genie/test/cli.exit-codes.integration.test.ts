import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { AggregatedProviderError, AuthConfigurationError, TimeoutError, UsageError, getExitCode } from '../src/errors.js'

describe('cli exit codes', () => {
  it('maps error classes to explicit exit codes', () => {
    expect(getExitCode(new UsageError('bad args'))).toBe(2)
    expect(getExitCode(new AuthConfigurationError('auth'))).toBe(3)
    expect(getExitCode(new TimeoutError('timeout'))).toBe(124)

    const authAggregate = new AggregatedProviderError([
      {
        provider: 'codex',
        stage: 'auth',
        reason: 'login required',
        authFailure: true,
      },
    ])
    expect(getExitCode(authAggregate)).toBe(3)

    const timeoutAggregate = new AggregatedProviderError([
      {
        provider: 'codex',
        stage: 'execution',
        reason: 'timed out',
        timeout: true,
      },
    ])
    expect(getExitCode(timeoutAggregate)).toBe(124)
  })

  it('returns exit code 2 for parse errors in spawned cli', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', '--unknown'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("Unknown option '--unknown'")
  })

  it('supports explicit help command and rejects invalid help topic', () => {
    const helpResult = spawnSync('bun', ['src/bin/genie.ts', 'help', 'run'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })
    expect(helpResult.status).toBe(0)
    expect(helpResult.stdout).toContain('Usage: genie run [options] <prompt>')
    expect(helpResult.stderr).toBe('')

    const badHelpResult = spawnSync('bun', ['src/bin/genie.ts', 'help', 'gleep'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })
    expect(badHelpResult.status).toBe(2)
    expect(badHelpResult.stderr).toContain("Unknown help topic 'gleep'")
  })
})
