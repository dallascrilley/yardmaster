import { providerIds, type ProviderId } from '../types.js'
import type { GenieConfig } from '../config/schema.js'
import { UsageError } from '../errors.js'

export function resolveProviderOrder(
  config: GenieConfig,
  explicit?: string,
  noFallback = false,
): {
  order: ProviderId[]
  explicitUsed: boolean
} {
  const explicitProvider = explicit?.trim().toLowerCase()
  const includes = (value: string): value is ProviderId => providerIds.includes(value as ProviderId)

  if (explicitProvider && !includes(explicitProvider)) {
    throw new UsageError(`Unknown provider '${explicit}'`)
  }

  const baseOrder = (() => {
    if (explicitProvider && includes(explicitProvider)) {
      return [explicitProvider, ...config.provider.fallbackOrder.filter((id) => id !== explicitProvider)]
    }

    return [
      config.provider.default,
      ...config.provider.fallbackOrder.filter((id) => id !== config.provider.default),
    ]
  })()

  const order = noFallback ? baseOrder.slice(0, 1) : baseOrder

  return {
    order,
    explicitUsed: Boolean(explicitProvider && includes(explicitProvider)),
  }
}
