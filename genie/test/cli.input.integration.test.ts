import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

describe('cli input integration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('reads run prompt text from --prompt-file', () => {
    const workDir = createTempDir('genie-input-work')
    tempDirs.push(workDir)

    const promptFile = join(workDir, 'prompt.txt')
    writeFileSync(promptFile, 'summarize this repo\n', 'utf8')

    const result = spawnSync(
      'bun',
      ['-e', `
        import { resolveRunPrompt } from './src/cli/dispatch/shared.ts'
        process.stdout.write(resolveRunPrompt(undefined, ${JSON.stringify(promptFile)}))
      `],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
      },
    )

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe('summarize this repo')
  })

  it('reads run prompt text from stdin when --prompt-file - is used', () => {
    const result = spawnSync(
      'bun',
      ['-e', `
        import { resolveRunPrompt } from './src/cli/dispatch/shared.ts'
        process.stdout.write(resolveRunPrompt(undefined, '-'))
      `],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
        input: 'prompt from stdin\n',
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('prompt from stdin')
  })

  it('falls back to --prompt-file when the provided prompt is empty', () => {
    const promptFile = createTempDir('genie-input-work')
    tempDirs.push(promptFile)

    const filePath = join(promptFile, 'prompt.txt')
    writeFileSync(filePath, 'prompt from file\n', 'utf8')

    const result = spawnSync(
      'bun',
      ['-e', `
        import { resolveRunPrompt } from './src/cli/dispatch/shared.ts'
        process.stdout.write(resolveRunPrompt('', ${JSON.stringify(filePath)}))
      `],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('prompt from file')
  })

  it('fails with a clear error when the provided prompt is empty and no prompt file exists', () => {
    const result = spawnSync(
      'bun',
      ['-e', `
        import { resolveRunPrompt } from './src/cli/dispatch/shared.ts'
        try {
          process.stdout.write(resolveRunPrompt('', undefined))
        } catch (error) {
          process.stderr.write(String(error instanceof Error ? error.message : error))
          process.exit(1)
        }
      `],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
      },
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Prompt is required')
  })

  it('reads debug input from --input-file', () => {
    const workDir = createTempDir('genie-input-work')
    tempDirs.push(workDir)

    const inputFile = join(workDir, 'error.log')
    writeFileSync(inputFile, 'TypeError: fetch failed\n', 'utf8')

    const result = spawnSync(
      'bun',
      ['-e', `
        import { readDebugInput } from './src/debug/command.ts'
        process.stdout.write(readDebugInput(${JSON.stringify(inputFile)}))
      `],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('TypeError: fetch failed')
  })
})
