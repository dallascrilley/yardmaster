import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

function createTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('cli quiet integration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('suppresses status-only success output for mutating config and presets commands', () => {
    const homeDir = createTempDir('genie-quiet-home')
    tempDirs.push(homeDir)

    const cwd = fileURLToPath(new URL('..', import.meta.url))
    const env = {
      ...process.env,
      HOME: homeDir,
    }

    const configInit = spawnSync('bun', ['src/bin/genie.ts', 'config', 'init', '--quiet'], { cwd, encoding: 'utf8', env })
    expect(configInit.status).toBe(0)
    expect(configInit.stdout).toBe('')
    expect(configInit.stderr).toBe('')

    const configSet = spawnSync('bun', ['src/bin/genie.ts', 'config', 'set', 'mode.default', 'default', '--quiet'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    expect(configSet.status).toBe(0)
    expect(configSet.stdout).toBe('')
    expect(configSet.stderr).toBe('')

    const presetSet = spawnSync(
      'bun',
      ['src/bin/genie.ts', 'presets', 'set', 'quiet-mode', '--provider', 'codex', '--quiet'],
      { cwd, encoding: 'utf8', env },
    )
    expect(presetSet.status).toBe(0)
    expect(presetSet.stdout).toBe('')
    expect(presetSet.stderr).toBe('')

    const presetUse = spawnSync('bun', ['src/bin/genie.ts', 'presets', 'use', 'quiet-mode', '--quiet'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    expect(presetUse.status).toBe(0)
    expect(presetUse.stdout).toBe('')
    expect(presetUse.stderr).toBe('')

    const presetDelete = spawnSync('bun', ['src/bin/genie.ts', 'presets', 'delete', 'quiet-mode', '--quiet', '--force'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    expect(presetDelete.status).toBe(0)
    expect(presetDelete.stdout).toBe('')
    expect(presetDelete.stderr).toBe('')
  })
})
