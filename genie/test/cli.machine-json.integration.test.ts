import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

import { afterEach, describe, expect, it } from 'vitest'

function createTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeMockClaudeBinary(binDir: string): void {
  const script = `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "claude 1.0.0"
  exit 0
fi
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "authenticated"
  exit 0
fi
echo "mocked response"
`

  const path = join(binDir, 'claude')
  writeFileSync(path, script, 'utf8')
  chmodSync(path, 0o755)
}

describe('cli machine-readable json integration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('emits the shared json envelope for run', () => {
    const binDir = createTempDir('genie-run-bin')
    const homeDir = createTempDir('genie-run-home')
    tempDirs.push(binDir, homeDir)
    writeMockClaudeBinary(binDir)

    const result = spawnSync('bun', ['src/bin/genie.ts', 'run', '--provider', 'claude', '--no-fallback', '--json', 'hello'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    const parsed = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({
      kind: 'run_result',
      version: 1,
      ok: true,
      exitCode: 0,
      provider: 'claude',
      response: 'mocked response',
      error: null,
    })
  })

  it('emits shared json envelopes for providers, config, and presets commands', () => {
    const binDir = createTempDir('genie-machine-bin')
    const homeDir = createTempDir('genie-machine-home')
    tempDirs.push(binDir, homeDir)
    writeMockClaudeBinary(binDir)

    const cwd = new URL('..', import.meta.url).pathname
    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
    }

    const providersList = spawnSync('bun', ['src/bin/genie.ts', 'providers', 'list', '--json'], { cwd, encoding: 'utf8', env })
    expect(providersList.status).toBe(0)
    expect(JSON.parse(providersList.stdout)).toMatchObject({
      kind: 'providers_list',
      version: 1,
      ok: true,
      exitCode: 0,
      error: null,
    })

    const providersDoctor = spawnSync('bun', ['src/bin/genie.ts', 'providers', 'doctor', '--provider', 'claude', '--json'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    expect(providersDoctor.status).toBe(0)
    expect(JSON.parse(providersDoctor.stdout)).toMatchObject({
      kind: 'providers_doctor',
      version: 1,
      ok: true,
      exitCode: 0,
      error: null,
      providers: [
        {
          provider: 'claude',
          available: true,
          authenticated: true,
        },
      ],
    })

    const configInit = spawnSync('bun', ['src/bin/genie.ts', 'config', 'init', '--json'], { cwd, encoding: 'utf8', env })
    expect(configInit.status).toBe(0)
    expect(JSON.parse(configInit.stdout)).toMatchObject({
      kind: 'config_init',
      version: 1,
      ok: true,
      exitCode: 0,
      error: null,
    })

    const configGet = spawnSync('bun', ['src/bin/genie.ts', 'config', 'get', 'provider.default', '--json'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    expect(configGet.status).toBe(0)
    expect(JSON.parse(configGet.stdout)).toMatchObject({
      kind: 'config_value',
      version: 1,
      ok: true,
      exitCode: 0,
      key: 'provider.default',
      error: null,
    })

    const configPath = spawnSync('bun', ['src/bin/genie.ts', 'config', 'path', '--json'], { cwd, encoding: 'utf8', env })
    expect(configPath.status).toBe(0)
    expect(JSON.parse(configPath.stdout)).toMatchObject({
      kind: 'config_path',
      version: 1,
      ok: true,
      exitCode: 0,
      error: null,
    })

    const presetSet = spawnSync(
      'bun',
      ['src/bin/genie.ts', 'presets', 'set', 'fast', '--provider', 'claude', '--output-format', 'json', '--json'],
      { cwd, encoding: 'utf8', env },
    )
    expect(presetSet.status).toBe(0)
    expect(JSON.parse(presetSet.stdout)).toMatchObject({
      kind: 'presets_set',
      version: 1,
      ok: true,
      exitCode: 0,
      name: 'fast',
      error: null,
    })

    const presetsList = spawnSync('bun', ['src/bin/genie.ts', 'presets', 'list', '--json'], { cwd, encoding: 'utf8', env })
    expect(presetsList.status).toBe(0)
    expect(JSON.parse(presetsList.stdout)).toMatchObject({
      kind: 'presets_list',
      version: 1,
      ok: true,
      exitCode: 0,
      error: null,
    })

    const presetsGet = spawnSync('bun', ['src/bin/genie.ts', 'presets', 'get', 'fast', '--json'], { cwd, encoding: 'utf8', env })
    expect(presetsGet.status).toBe(0)
    expect(JSON.parse(presetsGet.stdout)).toMatchObject({
      kind: 'presets_get',
      version: 1,
      ok: true,
      exitCode: 0,
      name: 'fast',
      error: null,
    })

    const presetsUse = spawnSync('bun', ['src/bin/genie.ts', 'presets', 'use', 'fast', '--json'], { cwd, encoding: 'utf8', env })
    expect(presetsUse.status).toBe(0)
    expect(JSON.parse(presetsUse.stdout)).toMatchObject({
      kind: 'presets_use',
      version: 1,
      ok: true,
      exitCode: 0,
      error: null,
      default: 'fast',
    })

    const presetsDelete = spawnSync('bun', ['src/bin/genie.ts', 'presets', 'delete', 'fast', '--json', '--force'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    expect(presetsDelete.status).toBe(0)
    expect(JSON.parse(presetsDelete.stdout)).toMatchObject({
      kind: 'presets_delete',
      version: 1,
      ok: true,
      exitCode: 0,
      error: null,
      deleted: 'fast',
    })
  })
})
