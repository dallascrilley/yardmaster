import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

function writeMockClaudeBinary(binDir: string, mode: 'success' | 'failure'): void {
  const script = `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "claude 1.0.0"
  exit 0
fi
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "authenticated"
  exit 0
fi
if [ "${mode}" = "failure" ]; then
  echo "provider execution failed" >&2
  exit 1
fi
echo "Root cause: mocked provider diagnosis"
echo "Why it happened: mocked provider explanation"
echo "Next step: rerun the failing command with one focused change"
echo "Confidence: medium"
`

  const path = join(binDir, 'claude')
  writeFileSync(path, script, 'utf8')
  chmodSync(path, 0o755)
}

describe('cli debug integration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('writes a diagnosis to stdout for piped terminal input', () => {
    const binDir = createTempDir('genie-debug-bin')
    const homeDir = createTempDir('genie-debug-home')
    tempDirs.push(binDir, homeDir)
    writeMockClaudeBinary(binDir, 'success')

    const result = spawnSync('bun', ['src/bin/genie.ts', 'debug', '--provider', 'claude', '--no-fallback'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      input: 'TypeError: fetch failed\n    at main (src/index.ts:1:1)\n',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Root cause: mocked provider diagnosis')
    expect(result.stdout).toContain('Confidence: medium')
    expect(result.stderr).toBe('')

    const configPath = join(homeDir, '.config', 'genie', 'config.json')
    expect(existsSync(configPath)).toBe(false)
  })

  it('fails fast with guidance when no piped input is supplied', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'debug', '--provider', 'claude'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('No terminal error input provided.')
    expect(result.stdout).toBe('')
  })

  it('returns a runtime failure when the provider cannot produce a diagnosis', () => {
    const binDir = createTempDir('genie-debug-bin')
    const homeDir = createTempDir('genie-debug-home')
    tempDirs.push(binDir, homeDir)
    writeMockClaudeBinary(binDir, 'failure')

    const result = spawnSync('bun', ['src/bin/genie.ts', 'debug', '--provider', 'claude', '--no-fallback'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      input: 'TypeError: fetch failed\n',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('All providers failed.')
    expect(result.stdout).toBe('')
  })

  it('emits the shared json envelope for debug when requested', () => {
    const binDir = createTempDir('genie-debug-bin')
    const homeDir = createTempDir('genie-debug-home')
    tempDirs.push(binDir, homeDir)
    writeMockClaudeBinary(binDir, 'success')

    const result = spawnSync('bun', ['src/bin/genie.ts', 'debug', '--provider', 'claude', '--no-fallback', '--json'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      input: 'TypeError: fetch failed\n    at main (src/index.ts:1:1)\n',
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
      kind: 'debug_result',
      version: 1,
      ok: true,
      exitCode: 0,
      provider: 'claude',
      error: null,
    })
    expect(parsed.response).toContain('Root cause: mocked provider diagnosis')
  })

  it('emits a shared json error envelope for debug failures when requested', () => {
    const binDir = createTempDir('genie-debug-bin')
    const homeDir = createTempDir('genie-debug-home')
    tempDirs.push(binDir, homeDir)
    writeMockClaudeBinary(binDir, 'failure')

    const result = spawnSync('bun', ['src/bin/genie.ts', 'debug', '--provider', 'claude', '--no-fallback', '--json'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      input: 'TypeError: fetch failed\n',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toBe('')
    const parsed = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({
      kind: 'error',
      version: 1,
      ok: false,
      exitCode: 1,
      error: {
        code: '1',
      },
    })
    expect(parsed.error.message).toContain('All providers failed.')
  })
})
