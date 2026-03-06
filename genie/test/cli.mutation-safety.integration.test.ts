import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

import { afterEach, describe, expect, it } from 'vitest'

describe('cli mutation safety integration', () => {
  const homes: string[] = []

  afterEach(() => {
    for (const home of homes) {
      rmSync(home, { recursive: true, force: true })
    }
    homes.length = 0
  })

  it('fails destructive update in non-interactive mode without --force', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'update', '--no-input'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('requires confirmation')
    expect(result.stderr).toContain('--force')
  })

  it('supports update dry-run json output without executing build/link', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'update', '--dry-run', '--json'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    const parsed = JSON.parse(result.stdout)
    expect(parsed.kind).toBe('update_result')
    expect(parsed.dryRun).toBe(true)
    expect(parsed.steps.map((step: { step: string }) => step.step)).toEqual(['build', 'link'])
  })

  it('fails preset deletion in non-interactive mode without --force and preserves the preset', () => {
    const home = join(tmpdir(), `genie-presets-${randomUUID()}`)
    mkdirSync(home, { recursive: true })
    homes.push(home)

    const env = {
      ...process.env,
      HOME: home,
    }

    const create = spawnSync(
      'bun',
      ['src/bin/genie.ts', 'presets', 'set', 'nightly', '--provider', 'codex', '--force'],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
        env,
      },
    )
    expect(create.status).toBe(0)

    const deleteAttempt = spawnSync('bun', ['src/bin/genie.ts', 'presets', 'delete', 'nightly', '--no-input'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env,
    })
    expect(deleteAttempt.status).toBe(2)
    expect(deleteAttempt.stderr).toContain('requires confirmation')

    const inspect = spawnSync('bun', ['src/bin/genie.ts', 'presets', 'get', 'nightly', '--json'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env,
    })
    expect(inspect.status).toBe(0)
    expect(JSON.parse(inspect.stdout).preset.provider).toBe('codex')
  })
})
