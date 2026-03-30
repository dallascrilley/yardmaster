import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { describe, expect, it, afterEach } from 'vitest'
import { defaultConfig, type GenieConfig } from '../src/config/schema.js'
import { loadConfig, loadUserConfig, resolveUserConfigPath, saveConfig, updateConfig } from '../src/config/store.js'

function createTempHome(): string {
  const home = join(tmpdir(), `genie-config-${randomUUID()}`)
  mkdirSync(home, { recursive: true })
  return home
}

describe('config store', () => {
  const homes: string[] = []

  afterEach(() => {
    for (const home of homes) {
      rmSync(home, { recursive: true, force: true })
    }
    homes.length = 0
  })

  it('returns default config when file is missing', async () => {
    const home = createTempHome()
    homes.push(home)
    const config = await loadConfig({ home })

    expect(config).toEqual(defaultConfig)
  })

  it('saves and loads config with persisted metadata', async () => {
    const home = createTempHome()
    homes.push(home)
    const sample: GenieConfig = {
      ...defaultConfig,
      provider: {
        ...defaultConfig.provider,
        default: 'gemini',
      },
      workspace: {
        ...defaultConfig.workspace,
        last: '/tmp/work',
      },
      _meta: {
        schema: 'genie-config-v1',
        savedAt: 'test',
      },
    }

    await saveConfig(sample, { home })
    const loaded = await loadConfig({ home })

    expect(loaded.provider.default).toBe('gemini')
    expect(loaded.workspace.last).toBe('/tmp/work')
    expect(loaded).toHaveProperty('_meta.schema', 'genie-config-v1')
  })

  it('merges partial updates and preserves other sections', async () => {
    const home = createTempHome()
    homes.push(home)

    const initial: GenieConfig = {
      ...defaultConfig,
      model: {
        byProvider: {
          claude: 'claude-3',
        },
      },
    }

    await saveConfig(initial, { home })
    const updated = await updateConfig((current) => ({
      ...current,
      workspace: {
        last: '/new/workspace',
      },
    }), { home })

    expect(updated.workspace.last).toBe('/new/workspace')
    expect(updated.model.byProvider.claude).toBe('claude-3')
  })

  it('merges valid sections when the file fails full-schema validation', async () => {
    const home = createTempHome()
    homes.push(home)
    const path = resolveUserConfigPath({ home })
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(
      path,
      JSON.stringify(
        {
          ...defaultConfig,
          provider: {
            default: 'not-a-valid-provider',
            fallbackOrder: ['claude'],
          },
          output: { default: 'json' },
        },
        null,
        2,
      ),
      'utf8',
    )

    const config = await loadUserConfig({ home })

    expect(config.provider.default).toBe('claude')
    expect(config.output.default).toBe('json')
  })
})
