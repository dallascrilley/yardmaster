import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

import { genieConfigSchema, type GenieConfig, defaultConfig, mergeConfig } from './schema.js'

export type ConfigStorageOptions = {
  home?: string
}

export function resolveConfigPath(options?: ConfigStorageOptions): string {
  const home = options?.home ?? homedir()
  return join(home, '.config', 'genie', 'config.json')
}

export async function loadConfig(options?: ConfigStorageOptions): Promise<GenieConfig> {
  const path = resolveConfigPath(options)

  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    const validated = genieConfigSchema.parse(parsed)
    return mergeConfig(defaultConfig, validated)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...defaultConfig }
    }
    return { ...defaultConfig }
  }
}

export async function saveConfig(config: GenieConfig, options?: ConfigStorageOptions): Promise<void> {
  const path = resolveConfigPath(options)
  const directory = dirname(path)
  mkdirSync(directory, { recursive: true })

  const marker = { _meta: { schema: 'genie-config-v1', savedAt: new Date().toISOString() } }
  const tmp = `${path}.${randomUUID()}.tmp`

  const content = { ...config, ...marker }
  writeFileSync(tmp, JSON.stringify(content, null, 2), 'utf8')
  renameSync(tmp, path)
}

export async function updateConfig(
  mutate: (current: GenieConfig) => GenieConfig,
  options?: ConfigStorageOptions,
): Promise<GenieConfig> {
  const current = await loadConfig(options)
  const updated = genieConfigSchema.parse(mutate(current))
  await saveConfig(updated, options)
  return updated
}
