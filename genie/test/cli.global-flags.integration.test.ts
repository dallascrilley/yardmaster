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

function writeEnvAwareClaudeBinary(binDir: string): void {
  const script = `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "claude 1.0.0"
  exit 0
fi
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "authenticated"
  exit 0
fi
printf 'env NO_COLOR=%s CI=%s\\n' "$NO_COLOR" "$CI"
`

  const path = join(binDir, 'claude')
  writeFileSync(path, script, 'utf8')
  chmodSync(path, 0o755)
}

describe('cli global flags integration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('passes --no-color and --no-input through to runtime and child process environment', () => {
    const binDir = createTempDir('genie-flags-bin')
    const homeDir = createTempDir('genie-flags-home')
    tempDirs.push(binDir, homeDir)
    writeEnvAwareClaudeBinary(binDir)

    const result = spawnSync(
      'bun',
      ['src/bin/genie.ts', 'run', '--provider', 'claude', '--no-fallback', '--no-color', '--no-input', 'hello'],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: homeDir,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('env NO_COLOR=1 CI=true')
  })

  it('suppresses confirmation-only output with --quiet', () => {
    const homeDir = createTempDir('genie-flags-home')
    tempDirs.push(homeDir)

    const result = spawnSync('bun', ['src/bin/genie.ts', 'config', 'init', '--quiet'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: homeDir,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })

  it('emits standardized verbose diagnostics on stderr', () => {
    const binDir = createTempDir('genie-flags-bin')
    const homeDir = createTempDir('genie-flags-home')
    tempDirs.push(binDir, homeDir)
    writeEnvAwareClaudeBinary(binDir)

    const result = spawnSync('bun', ['src/bin/genie.ts', 'providers', 'doctor', '--provider', 'claude', '--verbose'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('claude | available | authenticated')
    expect(result.stderr).toContain('[genie] command=providers-doctor provider=claude available=true authenticated=true')
  })

  it('keeps providers list json valid when verbose logging is enabled', () => {
    const binDir = createTempDir('genie-flags-bin')
    const homeDir = createTempDir('genie-flags-home')
    tempDirs.push(binDir, homeDir)
    writeEnvAwareClaudeBinary(binDir)

    const result = spawnSync('bun', ['src/bin/genie.ts', 'providers', 'list', '--json', '--verbose'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      kind: 'providers_list',
      ok: true,
    })
    expect(result.stderr).toContain('[genie] command=providers-list count=')
  })
})
