import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

import { type CliOutputMode, providerIds, type ProviderId } from '../types.js'
import { genieConfigSchema, type GenieConfig, defaultConfig, mergeConfig } from './schema.js'

function recoverValidConfigSections(parsed: Record<string, unknown>): Partial<GenieConfig> {
  const updates: Partial<GenieConfig> = {}
  const shape = genieConfigSchema.shape
  for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
    if (!(key in parsed)) continue
    const fieldSchema = shape[key]
    const result = fieldSchema.safeParse(parsed[key])
    if (result.success) {
      Object.assign(updates, { [key]: result.data } as Partial<GenieConfig>)
    }
  }
  return updates
}

export type ConfigStorageOptions = {
  home?: string
  cwd?: string
}

export type ConfigFlagOverrides = {
  provider?: ProviderId
  model?: string
  mode?: string
  workspace?: string
  trust?: boolean
  timeoutMs?: number
  output?: CliOutputMode
}

function resolveHomeDirectory(explicitHome?: string): string {
  const envHome = process.env.HOME?.trim()
  if (explicitHome?.trim()) {
    return explicitHome
  }
  if (envHome) {
    return envHome
  }
  return homedir()
}

function safeParseConfig(raw: string): Partial<GenieConfig> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    process.stderr.write(`Warning: config file contains invalid JSON: ${error instanceof Error ? error.message : String(error)}\n`)
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    process.stderr.write('Warning: config file does not contain a JSON object\n')
    return {}
  }
  const obj = parsed as Record<string, unknown>
  const full = genieConfigSchema.safeParse(obj)
  if (full.success) {
    return full.data
  }

  const partial = recoverValidConfigSections(obj)
  const detail = full.error.message
  if (Object.keys(partial).length > 0) {
    process.stderr.write(`Warning: config file failed full validation; merged valid sections only. ${detail}\n`)
    return partial
  }

  process.stderr.write(`Warning: config file failed validation; using defaults instead. ${detail}\n`)
  return {}
}

export function resolveUserConfigPath(options?: ConfigStorageOptions): string {
  const home = resolveHomeDirectory(options?.home)
  return join(home, '.config', 'genie', 'config.json')
}

export function resolveProjectConfigPath(options?: ConfigStorageOptions): string {
  const cwd = options?.cwd ?? process.cwd()
  return join(resolve(cwd), '.genie', 'config.json')
}

function parseConfigFile(path: string): Partial<GenieConfig> {
  try {
    return safeParseConfig(readFileSync(path, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    process.stderr.write(`Warning: failed to read config at ${path}: ${error instanceof Error ? error.message : String(error)}\n`)
    return {}
  }
}

function toEnvBool(value: string | undefined): boolean | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return undefined
}

function toEnvOutput(value: string | undefined): CliOutputMode | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'auto' || normalized === 'pretty' || normalized === 'json' || normalized === 'plain') {
    return normalized
  }
  return undefined
}

function toEnvProvider(value: string | undefined): ProviderId | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (providerIds.includes(normalized as ProviderId)) {
    return normalized as ProviderId
  }
  return undefined
}

function toEnvTimeout(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }
  return Math.floor(parsed)
}

export function envConfigFromProcess(env: NodeJS.ProcessEnv = process.env): Partial<GenieConfig> {
  const provider = toEnvProvider(env.GENIE_PROVIDER)
  const model = env.GENIE_MODEL?.trim() || undefined
  const mode = env.GENIE_MODE?.trim() || undefined
  const workspace = env.GENIE_WORKSPACE?.trim() || undefined
  const trust = toEnvBool(env.GENIE_TRUST)
  const timeoutMs = toEnvTimeout(env.GENIE_TIMEOUT_MS)
  const output = toEnvOutput(env.GENIE_OUTPUT)

  return {
    ...(provider
      ? {
          provider: {
            default: provider,
            fallbackOrder: [provider, ...defaultConfig.provider.fallbackOrder.filter((id) => id !== provider)],
          },
        }
      : {}),
    ...(model ? { model: { byProvider: provider ? { [provider]: model } : {} } } : {}),
    ...(mode ? { mode: { default: mode } } : {}),
    ...(workspace ? { workspace: { last: workspace } } : {}),
    ...(typeof trust === 'boolean' ? { trust: { default: trust } } : {}),
    ...(typeof timeoutMs === 'number' ? { runtime: { timeoutMs } } : {}),
    ...(output ? { output: { default: output } } : {}),
  }
}

export async function loadUserConfig(options?: ConfigStorageOptions): Promise<GenieConfig> {
  const path = resolveUserConfigPath(options)
  const parsed = parseConfigFile(path)
  return mergeConfig(defaultConfig, parsed)
}

export async function loadProjectConfig(options?: ConfigStorageOptions): Promise<Partial<GenieConfig>> {
  const path = resolveProjectConfigPath(options)
  return parseConfigFile(path)
}

export async function loadConfig(params?: ConfigStorageOptions & { flags?: ConfigFlagOverrides }): Promise<GenieConfig> {
  const userConfig = await loadUserConfig(params)
  const projectConfig = await loadProjectConfig(params)
  const envConfig = envConfigFromProcess()
  const flagsConfig: Partial<GenieConfig> = {
    ...(params?.flags?.provider
      ? {
          provider: {
            default: params.flags.provider,
            fallbackOrder: [
              params.flags.provider,
              ...defaultConfig.provider.fallbackOrder.filter((id) => id !== params.flags?.provider),
            ],
          },
        }
      : {}),
    ...(params?.flags?.model
      ? {
          model: {
            byProvider: params.flags.provider ? { [params.flags.provider]: params.flags.model } : {},
          },
        }
      : {}),
    ...(params?.flags?.mode ? { mode: { default: params.flags.mode } } : {}),
    ...(params?.flags?.workspace ? { workspace: { last: params.flags.workspace } } : {}),
    ...(typeof params?.flags?.trust === 'boolean' ? { trust: { default: params.flags.trust } } : {}),
    ...(typeof params?.flags?.timeoutMs === 'number'
      ? { runtime: { timeoutMs: params.flags.timeoutMs } }
      : {}),
    ...(params?.flags?.output ? { output: { default: params.flags.output } } : {}),
  }

  return mergeConfig(
    mergeConfig(mergeConfig(mergeConfig(defaultConfig, userConfig), projectConfig), envConfig),
    flagsConfig,
  )
}

export async function saveConfig(config: GenieConfig, options?: ConfigStorageOptions): Promise<void> {
  const path = resolveUserConfigPath(options)
  const directory = dirname(path)
  mkdirSync(directory, { recursive: true })

  const marker = { schema: 'genie-config-v1', savedAt: new Date().toISOString() }
  const tmp = `${path}.${randomUUID()}.tmp`

  const content = {
    ...config,
    _meta: marker,
  }
  writeFileSync(tmp, JSON.stringify(content, null, 2), 'utf8')
  renameSync(tmp, path)
}

export async function initUserConfig(options?: ConfigStorageOptions): Promise<GenieConfig> {
  const current = await loadUserConfig(options)
  await saveConfig(current, options)
  return current
}

export async function updateConfig(
  mutate: (current: GenieConfig) => GenieConfig,
  options?: ConfigStorageOptions,
): Promise<GenieConfig> {
  const current = await loadUserConfig(options)
  const updated = genieConfigSchema.parse(mutate(current))
  await saveConfig(updated, options)
  return updated
}
