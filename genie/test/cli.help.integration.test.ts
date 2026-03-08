import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('cli help integration', () => {
  it('shows workflow-oriented root help for bare invocation', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Unified AI CLI for prompt execution, terminal debugging, diff review, and provider-aware automation.')
    expect(result.stdout).toContain('Start here:')
    expect(result.stdout).toContain('Examples:')
    expect(result.stdout).toContain('Next commands:')
    expect(result.stdout).toContain('genie help run')
    expect(result.stdout).toContain('genie help design')
    expect(result.stdout).toContain('design     Get frontend design feedback and UI recommendations.')
  })

  it('keeps explicit root help aligned with bare invocation output', () => {
    const bare = spawnSync('bun', ['src/bin/genie.ts'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })
    const help = spawnSync('bun', ['src/bin/genie.ts', 'help'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(bare.status).toBe(0)
    expect(help.status).toBe(0)
    expect(help.stderr).toBe('')
    expect(help.stdout).toBe(bare.stdout)
  })

  it('shows task-oriented run help with examples and precedence guidance', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'help', 'run'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Execute a prompt with provider routing, config defaults, and machine-readable output modes.')
    expect(result.stdout).toContain('Common flows:')
    expect(result.stdout).toContain('Config and precedence:')
    expect(result.stdout).toContain('GENIE_PROVIDER')
    expect(result.stdout).toContain('--prompt-file <path|->')
    expect(result.stdout).toContain('Recovery tips:')
  })

  it('shows design help with examples and provider guidance', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'help', 'design'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Usage: genie design [options] <prompt>')
    expect(result.stdout).toContain('Get frontend design feedback and implementation-aware UI recommendations')
    expect(result.stdout).toContain('Common flows:')
    expect(result.stdout).toContain('--prompt-file <path|->')
    expect(result.stdout).toContain('Recovery tips:')
  })

  it('shows config help with paths, precedence, env vars, and keys', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'help', 'config'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Inspect and change persistent defaults that affect run/debug behavior.')
    expect(result.stdout).toContain('Supported keys:')
    expect(result.stdout).toContain('Config locations and precedence:')
    expect(result.stdout).toContain('GENIE_STRICT_COMMANDS')
    expect(result.stdout).toContain('genie config set provider.default codex')
    expect(result.stdout).toContain('Safety:')
    expect(result.stdout).toContain('--force')
  })

  it('shows completion help with install guidance', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'help', 'completion'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Usage: genie completion <bash|zsh|fish>')
    expect(result.stdout).toContain('Install notes:')
    expect(result.stdout).toContain('genie completion zsh > ~/.zfunc/_genie')
  })
})
