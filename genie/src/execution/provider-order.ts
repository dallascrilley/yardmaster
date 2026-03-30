import type { GenieConfig } from '../config/schema.js'
import { UsageError } from '../errors.js'
import { type ProviderId } from '../types.js'
import { isConfigProviderId, resolveConfigProviderToken } from './provider-aliases.js'

export type ProviderExecutionSlot = {
  provider: ProviderId
  aliasModel?: string
}

function withoutSameCanonicalProvider(fallbackTokens: string[], skip: ProviderId): string[] {
  return fallbackTokens.filter((t) => resolveConfigProviderToken(t).provider !== skip)
}

function tokensToSlots(tokens: string[]): ProviderExecutionSlot[] {
  const seen = new Set<ProviderId>()
  const slots: ProviderExecutionSlot[] = []
  for (const token of tokens) {
    const { provider, aliasModel } = resolveConfigProviderToken(token)
    if (seen.has(provider)) {
      continue
    }
    seen.add(provider)
    slots.push({ provider, aliasModel })
  }
  return slots
}

export function resolveProviderExecutionPlan(
  config: GenieConfig,
  explicitCanonical: ProviderId | undefined,
  noFallback: boolean,
): {
  slots: ProviderExecutionSlot[]
  explicitUsed: boolean
} {
  const baseTokens = (() => {
    if (explicitCanonical) {
      return [explicitCanonical, ...withoutSameCanonicalProvider(config.provider.fallbackOrder.map(String), explicitCanonical)]
    }

    const defaultTok = String(config.provider.default)
    const defaultResolved = resolveConfigProviderToken(defaultTok)
    return [
      defaultTok,
      ...config.provider.fallbackOrder
        .map(String)
        .filter((t) => t !== defaultTok)
        .filter((t) => resolveConfigProviderToken(t).provider !== defaultResolved.provider),
    ]
  })()

  const slots = tokensToSlots(baseTokens)
  const trimmed = noFallback ? slots.slice(0, 1) : slots

  return {
    slots: trimmed,
    explicitUsed: Boolean(explicitCanonical),
  }
}

export function resolveProviderOrder(
  config: GenieConfig,
  explicit?: string,
  noFallback = false,
): {
  order: ProviderId[]
  explicitUsed: boolean
} {
  const explicitTrim = explicit?.trim().toLowerCase()
  if (explicitTrim && !isConfigProviderId(explicitTrim)) {
    throw new UsageError(`Unknown provider '${explicit}'`)
  }

  const explicitCanonical = explicitTrim
    ? resolveConfigProviderToken(explicitTrim).provider
    : undefined

  const { slots, explicitUsed } = resolveProviderExecutionPlan(config, explicitCanonical, noFallback)
  return {
    order: slots.map((s) => s.provider),
    explicitUsed,
  }
}
