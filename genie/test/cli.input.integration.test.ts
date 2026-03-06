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

function writeEchoClaudeBinary(binDir: string): void {
  const script = `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "claude 1.0.0"
  exit 0
fi
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "authenticated"
  exit 0
fi
printf '%s' "$1"
`

  const path = join(binDir, 'claude')
  writeFileSync(path, script, 'utf8')
  chmodSync(path, 0o755)
}

describe('cli input integration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('reads run prompt text from --prompt-file', () => {
    const binDir = createTempDir('genie-input-bin')
    const homeDir = createTempDir('genie-input-home')
    const workDir = createTempDir('genie-input-work')
    tempDirs.push(binDir, homeDir, workDir)
    writeEchoClaudeBinary(binDir)

    const promptFile = join(workDir, 'prompt.txt')
    writeFileSync(promptFile, 'summarize this repo\n', 'utf8')

    const result = spawnSync(
      'bun',
      ['src/bin/genie.ts', 'run', '--provider', 'claude', '--no-fallback', '--json', '--prompt-file', promptFile],
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
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout).response).toBe('summarize this repo')
  })

  it('reads run prompt text from stdin when --prompt-file - is used', () => {
    const binDir = createTempDir('genie-input-bin')
    const homeDir = createTempDir('genie-input-home')
    tempDirs.push(binDir, homeDir)
    writeEchoClaudeBinary(binDir)

    const result = spawnSync(
      'bun',
      ['src/bin/genie.ts', 'run', '--provider', 'claude', '--no-fallback', '--json', '--prompt-file', '-'],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
        input: 'prompt from stdin\n',
        env: {
          ...process.env,
          HOME: homeDir,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
      },
    )

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout).response).toBe('prompt from stdin')
  })

  it('reads debug input from --input-file', () => {
    const binDir = createTempDir('genie-input-bin')
    const homeDir = createTempDir('genie-input-home')
    const workDir = createTempDir('genie-input-work')
    tempDirs.push(binDir, homeDir, workDir)
    writeEchoClaudeBinary(binDir)

    const inputFile = join(workDir, 'error.log')
    writeFileSync(inputFile, 'TypeError: fetch failed\n', 'utf8')

    const result = spawnSync(
      'bun',
      ['src/bin/genie.ts', 'debug', '--provider', 'claude', '--no-fallback', '--input-file', inputFile],
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
    expect(result.stdout).toContain('TypeError: fetch failed')
  })
})
