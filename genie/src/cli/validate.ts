import { isConfigProviderId } from '../execution/provider-aliases.js'
import { configProviderIds, modeIds, type ConfigProviderId, type ProviderOutputFormat } from '../types.js'
import { UsageError } from '../errors.js'

export function parseProvider(value: string, flag: string): ConfigProviderId {
  const normalized = value.trim().toLowerCase()
  if (!isConfigProviderId(normalized)) {
    throw new UsageError(
      `Unknown provider '${value}' for ${flag}. Expected one of: ${configProviderIds.join(', ')}`,
    )
  }
  return normalized
}

export function parseOutputFormat(value: string, flag: string): ProviderOutputFormat {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'text' || normalized === 'json' || normalized === 'stream-json') {
    return normalized
  }
  throw new UsageError(`Unknown output format '${value}' for ${flag}`)
}

export function parseMode(value: string, flag: string): (typeof modeIds)[number] {
  const normalized = value.trim().toLowerCase()
  if (!modeIds.includes(normalized as (typeof modeIds)[number])) {
    throw new UsageError(`Unknown mode '${value}' for ${flag}. Expected one of: ${modeIds.join(', ')}`)
  }
  return normalized as (typeof modeIds)[number]
}

export function isStrictCommandsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.GENIE_STRICT_COMMANDS?.trim().toLowerCase()
  if (!value) return true
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') {
    return false
  }
  return true
}

export function parseListValue(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
