import { UsageError } from '../errors.js'
import {
  configProviderIds,
  type ConfigProviderId,
  type ProviderAliasId,
  type ProviderId,
  providerIds,
} from '../types.js'

/** Which canonical CLI slot `pi` substitutes for (default gemini). */
export const GENIE_PI_BACKEND_ENV = 'GENIE_PI_BACKEND'

export const PROVIDER_ALIAS_REGISTRY = {
  pi: { modelEnvVar: 'GENIE_PI_MODEL' as const },
} satisfies Record<ProviderAliasId, { modelEnvVar?: string }>

export function resolvePiBackendProvider(): ProviderId {
  const raw = process.env[GENIE_PI_BACKEND_ENV]?.trim().toLowerCase()
  if (raw && (providerIds as readonly string[]).includes(raw)) {
    return raw as ProviderId
  }
  return 'gemini'
}

export function isConfigProviderId(value: string): value is ConfigProviderId {
  return (configProviderIds as readonly string[]).includes(value.trim().toLowerCase())
}

function isAliasToken(token: string): boolean {
  const k = token.trim().toLowerCase()
  return k in PROVIDER_ALIAS_REGISTRY
}

export function resolveConfigProviderToken(token: string): { provider: ProviderId; aliasModel?: string } {
  const k = token.trim().toLowerCase()
  if (k === 'pi') {
    const def = PROVIDER_ALIAS_REGISTRY.pi
    const envModel = def.modelEnvVar ? process.env[def.modelEnvVar]?.trim() : undefined
    return {
      provider: resolvePiBackendProvider(),
      aliasModel: envModel && envModel.length > 0 ? envModel : undefined,
    }
  }
  if (providerIds.includes(k as ProviderId)) {
    return { provider: k as ProviderId }
  }
  throw new UsageError(`Unknown provider '${token}'`)
}

export function isProviderAliasToken(token: string): boolean {
  return isAliasToken(token)
}
