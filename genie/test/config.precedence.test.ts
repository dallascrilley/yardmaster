import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it } from 'vitest'

import { loadConfig, saveConfig } from '../src/config/store.js'
import { defaultConfig } from '../src/config/schema.js'

function createTempDir(prefix: string): string {
  const path = join(tmpdir(), `${prefix}-${randomUUID()}`)
  mkdirSync(path, { recursive: true })
  return path
}

describe('config precedence', () => {
  const tempPaths: string[] = []

  afterEach(() => {
    for (const path of tempPaths) {
      rmSync(path, { recursive: true, force: true })
    }
    tempPaths.length = 0

    delete process.env.GENIE_PROVIDER
    delete process.env.GENIE_MODEL
    delete process.env.GENIE_MODE
    delete process.env.GENIE_WORKSPACE
    delete process.env.GENIE_TRUST
    delete process.env.GENIE_TIMEOUT_MS
    delete process.env.GENIE_OUTPUT
  })

  it('resolves precedence flags > env > project > user > defaults', async () => {
    const home = createTempDir('genie-home')
    const cwd = createTempDir('genie-cwd')
    tempPaths.push(home, cwd)

    await saveConfig(
      {
        ...defaultConfig,
        provider: {
          ...defaultConfig.provider,
          default: 'claude',
        },
        output: {
          default: 'pretty',
        },
      },
      { home },
    )

    const projectDir = join(cwd, '.genie')
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(
      join(projectDir, 'config.json'),
      JSON.stringify(
        {
          provider: {
            default: 'gemini',
            fallbackOrder: ['gemini', 'codex', 'claude', 'cursor-agent'],
          },
          output: {
            default: 'json',
          },
        },
        null,
        2,
      ),
    )

    process.env.GENIE_PROVIDER = 'codex'
    process.env.GENIE_OUTPUT = 'plain'

    const merged = await loadConfig({
      home,
      cwd,
      flags: {
        provider: 'cursor-agent',
        output: 'json',
      },
    })

    expect(merged.provider.default).toBe('cursor-agent')
    expect(merged.output.default).toBe('json')
  })
})
