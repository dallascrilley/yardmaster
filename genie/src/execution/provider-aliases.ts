import { UsageError } from '../errors.js'
import {
  configProviderIds,
  type ConfigProviderId,
  type ProviderAliasId,
  type ProviderId,
  providerIds,
} from '../types.js'

export const PROVIDER_ALIAS_REGISTRY = {
  pi: { target: 'gemini' as const, modelEnvVar: 'GENIE_PI_MODEL' as const },
} satisfies Record<ProviderAliasId, { target: ProviderId; modelEnvVar?: string }>

export function isConfigProviderId(value: string): value is ConfigProviderId {
  return (configProviderIds as readonly string[]).includes(value.trim().toLowerCase())
}

export function resolveConfigProviderToken(token: string): { provider: ProviderId; aliasModel?: string } {
  const k = token.trim().toLowerCase()
  if (k in PROVIDER_ALIAS_REGISTRY) {
    const def = PROVIDER_ALIAS_REGISTRY[k as ProviderAliasId]
    const envModel = def.modelEnvVar ? process.env[def.modelEnvVar]?.trim() : undefined
    return {
      provider: def.target,
      aliasModel: envModel && envModel.length > 0 ? envModel : undefined,
    }
  }
  if (providerIds.includes(k as ProviderId)) {
    return { provider: k as ProviderId }
  }
  throw new UsageError(`Unknown provider '${token}'`)
}
