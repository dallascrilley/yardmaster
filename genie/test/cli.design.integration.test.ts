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
echo "## Overall direction"
echo "Promising structure, but the hierarchy needs more contrast."
echo
echo "## Recommended improvements"
echo "- Increase headline contrast"
echo "- Make the CTA more visually dominant"
`

  const path = join(binDir, 'claude')
  writeFileSync(path, script, 'utf8')
  chmodSync(path, 0o755)
}

describe('cli design integration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('writes frontend design guidance to stdout', () => {
    const binDir = createTempDir('genie-design-bin')
    const homeDir = createTempDir('genie-design-home')
    tempDirs.push(binDir, homeDir)
    writeMockClaudeBinary(binDir, 'success')

    const result = spawnSync('bun', ['src/bin/genie.ts', 'design', '--provider', 'claude', '--no-fallback', 'review the pricing hero'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('## Overall direction')
    expect(result.stdout).toContain('## Recommended improvements')
    expect(result.stderr).toBe('')

    const configPath = join(homeDir, '.config', 'genie', 'config.json')
    expect(existsSync(configPath)).toBe(false)
  })

  it('emits the shared json envelope for design when requested', () => {
    const binDir = createTempDir('genie-design-bin')
    const homeDir = createTempDir('genie-design-home')
    tempDirs.push(binDir, homeDir)
    writeMockClaudeBinary(binDir, 'success')

    const result = spawnSync('bun', ['src/bin/genie.ts', 'design', '--provider', 'claude', '--no-fallback', '--json', 'review the pricing hero'], {
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
      kind: 'design_result',
      version: 1,
      ok: true,
      exitCode: 0,
      provider: 'claude',
      error: null,
    })
    expect(parsed.response).toContain('## Overall direction')
  })

  it('returns a usage error when no design prompt is supplied', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'design'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Prompt is required')
    expect(result.stdout).toBe('')
  })
})
