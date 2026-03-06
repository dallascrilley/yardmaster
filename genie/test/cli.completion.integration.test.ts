import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

describe('cli completion integration', () => {
  it('renders bash completion script', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'completion', 'bash'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('complete -F _genie genie')
    expect(result.stdout).toContain('run debug review update providers config presets help completion')
  })

  it('renders zsh and fish completion scripts', () => {
    const zsh = spawnSync('bun', ['src/bin/genie.ts', 'completion', 'zsh'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })
    const fish = spawnSync('bun', ['src/bin/genie.ts', 'completion', 'fish'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(zsh.status).toBe(0)
    expect(zsh.stdout).toContain('#compdef genie')
    expect(zsh.stdout).toContain("completion:Generate shell completion")

    expect(fish.status).toBe(0)
    expect(fish.stdout).toContain('complete -c genie -n "__fish_use_subcommand" -a "completion"')
    expect(fish.stdout).toContain('complete -c genie -n "__fish_seen_subcommand_from completion" -a "fish"')
  })
})
