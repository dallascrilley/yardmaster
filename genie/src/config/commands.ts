import { existsSync } from 'node:fs'

import { UsageError } from '../errors.js'
import { isConfigProviderId, resolveConfigProviderToken } from '../execution/provider-aliases.js'
import { configProviderIds, modeIds, type ConfigProviderId } from '../types.js'
import { defaultConfig, genieConfigSchema, type GenieConfig } from './schema.js'
import { initUserConfig, loadConfig, loadUserConfig, resolveProjectConfigPath, resolveUserConfigPath, updateConfig } from './store.js'

const configKeys = [
  'provider.default',
  'provider.fallbackOrder',
  'model.byProvider',
  'mode.default',
  'workspace.last',
  'output.default',
  'trust.default',
  'runtime.timeoutMs',
] as const

export type ConfigKey = (typeof configKeys)[number]

export function isConfigKey(value: string): value is ConfigKey {
  return (configKeys as readonly string[]).includes(value)
}

function parseConfigProviderValue(value: string): ConfigProviderId {
  const normalized = value.trim().toLowerCase()
  if (!isConfigProviderId(normalized)) {
    throw new UsageError(`Invalid provider '${value}'. Expected one of: ${configProviderIds.join(', ')}`)
  }
  return normalized
}

function parseValueByKey(key: ConfigKey, value: string): unknown {
  switch (key) {
    case 'provider.default':
      return parseConfigProviderValue(value)
    case 'provider.fallbackOrder': {
      const ids = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map(parseConfigProviderValue)
      if (ids.length === 0) {
        throw new UsageError('provider.fallbackOrder requires at least one provider')
      }
      return ids
    }
    case 'model.byProvider': {
      const entries = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      const parsed: Record<string, string> = {}
      for (const entry of entries) {
        const [provider, model] = entry.split('=').map((part) => part?.trim())
        if (!provider || !model) {
          throw new UsageError('model.byProvider must use provider=model pairs separated by commas')
        }
        const canonical = resolveConfigProviderToken(parseConfigProviderValue(provider)).provider
        parsed[canonical] = model
      }
      return parsed
    }
    case 'mode.default':
      if (!value.trim()) throw new UsageError('mode.default cannot be empty')
      if (!modeIds.includes(value.trim() as (typeof modeIds)[number])) {
        throw new UsageError(`mode.default must be one of: ${modeIds.join(', ')}`)
      }
      return value.trim()
    case 'workspace.last':
      if (!value.trim()) throw new UsageError('workspace.last cannot be empty')
      return value.trim()
    case 'output.default': {
      const normalized = value.trim().toLowerCase()
      if (!['auto', 'pretty', 'json', 'plain'].includes(normalized)) {
        throw new UsageError("output.default must be one of: auto, pretty, json, plain")
      }
      return normalized
    }
    case 'trust.default': {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true
      if (['false', '0', 'no', 'off'].includes(normalized)) return false
      throw new UsageError('trust.default must be a boolean')
    }
    case 'runtime.timeoutMs': {
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new UsageError('runtime.timeoutMs must be a positive integer')
      }
      return Math.floor(parsed)
    }
    default:
      return value
  }
}

function getByPath(config: GenieConfig, key?: string): unknown {
  if (!key) return config
  const segments = key.split('.')
  let current: unknown = config
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function applyConfigValue(current: GenieConfig, key: ConfigKey, parsed: unknown): GenieConfig {
  const next: GenieConfig = structuredClone(current)
  const segments = key.split('.')
  let target: Record<string, unknown> = next as unknown as Record<string, unknown>

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    if (!target[segment] || typeof target[segment] !== 'object') {
      target[segment] = {}
    }
    target = target[segment] as Record<string, unknown>
  }

  target[segments[segments.length - 1]] = parsed

  return genieConfigSchema.parse({
    ...defaultConfig,
    ...next,
  })
}

export async function configGet(key?: string): Promise<unknown> {
  if (key && !isConfigKey(key)) {
    throw new UsageError(`Unknown config key '${key}'`)
  }
  const config = await loadConfig()
  return key ? getByPath(config, key) : config
}

export async function configSet(key: string, value: string): Promise<GenieConfig> {
  if (!isConfigKey(key)) {
    throw new UsageError(`Unknown config key '${key}'`)
  }

  const parsed = parseValueByKey(key, value)

  const updated = await updateConfig((current) => {
    return applyConfigValue(current, key, parsed)
  })

  return updated
}

export async function previewConfigSet(key: string, value: string): Promise<GenieConfig> {
  if (!isConfigKey(key)) {
    throw new UsageError(`Unknown config key '${key}'`)
  }

  const parsed = parseValueByKey(key, value)
  const current = await loadUserConfig()
  return applyConfigValue(current, key, parsed)
}

export async function configInit(): Promise<GenieConfig> {
  return initUserConfig()
}

export async function previewConfigInit(): Promise<{ path: string; exists: boolean; config: GenieConfig }> {
  const path = resolveUserConfigPath()
  return {
    path,
    exists: existsSync(path),
    config: await loadUserConfig(),
  }
}

export function configPath(): { user: string; project: string } {
  return {
    user: resolveUserConfigPath(),
    project: resolveProjectConfigPath(),
  }
}
