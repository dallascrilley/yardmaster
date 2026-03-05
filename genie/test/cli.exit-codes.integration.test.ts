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

  it('returns exit code 2 for invalid mode values before execution', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'run', '--mode', 'invalidmode', 'hello'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("Unknown mode 'invalidmode' for --mode")
  })

  it('returns exit code 2 for invalid update arguments', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'update', '--nope'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("Unknown update argument '--nope'")
  })

  it('returns exit code 2 when review target flags are invalid', () => {
    const conflict = spawnSync('bun', ['src/bin/genie.ts', 'review', '--all', '--agent', 'codex'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })
    expect(conflict.status).toBe(2)
    expect(conflict.stderr).toContain('--all cannot be used with --agent')

    const missingTarget = spawnSync('bun', ['src/bin/genie.ts', 'review'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })
    expect(missingTarget.status).toBe(2)
    expect(missingTarget.stderr).toContain('A review target is required')

    const stagedDiffFileConflict = spawnSync(
      'bun',
      ['src/bin/genie.ts', 'review', '--all', '--staged', '--diff-file', 'x.diff'],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
      },
    )
    expect(stagedDiffFileConflict.status).toBe(2)
    expect(stagedDiffFileConflict.stderr).toContain('--staged cannot be used with --diff-file')

    const baseStagedConflict = spawnSync('bun', ['src/bin/genie.ts', 'review', '--all', '--base', 'main', '--staged'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })
    expect(baseStagedConflict.status).toBe(2)
    expect(baseStagedConflict.stderr).toContain('--base cannot be used with --staged')
  })

  it('returns exit code 2 for unknown root token when strict mode is enabled', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'gleep'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env: {
        ...process.env,
        GENIE_STRICT_COMMANDS: '1',
      },
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("Unknown command 'gleep'. Use 'genie help' for usage.")
  })

  it('returns exit code 2 for unknown root token with leading global flags in strict mode', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', '--json', 'gleep'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env: {
        ...process.env,
        GENIE_STRICT_COMMANDS: '1',
      },
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain("Unknown command 'gleep'. Use 'genie help' for usage.")
  })
})
