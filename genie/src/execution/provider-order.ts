import type { GenieConfig } from '../config/schema.js'
import { UsageError } from '../errors.js'
import { type ProviderId } from '../types.js'
import {
  isConfigProviderId,
  isProviderAliasToken,
  resolveConfigProviderToken,
} from './provider-aliases.js'

export type ProviderExecutionSlot = {
  provider: ProviderId
  aliasModel?: string
}

function withoutSameCanonicalProvider(fallbackTokens: string[], skip: ProviderId): string[] {
  return fallbackTokens.filter((t) => resolveConfigProviderToken(t).provider !== skip)
}

function tokensToSlots(tokens: string[]): ProviderExecutionSlot[] {
  type Entry = { index: number; provider: ProviderId; aliasModel?: string; fromAlias: boolean }
  const entries: Entry[] = tokens.map((token, index) => {
    const { provider, aliasModel } = resolveConfigProviderToken(token)
    return {
      index,
      provider,
      aliasModel,
      fromAlias: isProviderAliasToken(token),
    }
  })

  const byProvider = new Map<ProviderId, Entry[]>()
  for (const entry of entries) {
    const list = byProvider.get(entry.provider) ?? []
    list.push(entry)
    byProvider.set(entry.provider, list)
  }

  const ordered = [...byProvider.entries()]
    .map(([provider, group]) => {
      const minIndex = Math.min(...group.map((g) => g.index))
      const aliasesInOrder = group.filter((g) => g.fromAlias).sort((a, b) => a.index - b.index)
      const aliasModel =
        aliasesInOrder.length > 0
          ? aliasesInOrder.map((g) => g.aliasModel).find((m) => m !== undefined && m.length > 0)
          : undefined
      return { provider, aliasModel, minIndex }
    })
    .sort((a, b) => a.minIndex - b.minIndex)

  return ordered.map(({ provider, aliasModel }) => ({ provider, aliasModel }))
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
