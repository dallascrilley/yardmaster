import type { YardmasterConfig } from '../config/schema.js'
import { type ProviderId } from '../types.js'
import {
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
   config: YardmasterConfig,
   explicitProviderToken: string | undefined,
   noFallback: boolean,
): {
   slots: ProviderExecutionSlot[]
   explicitUsed: boolean
} {
   const explicitToken = explicitProviderToken?.trim().toLowerCase()
   const explicitResolved = explicitToken
      ? resolveConfigProviderToken(explicitToken)
      : undefined

   const baseTokens = (() => {
      if (explicitToken && explicitResolved) {
         return [
            explicitToken,
            ...withoutSameCanonicalProvider(config.provider.fallbackOrder.map(String), explicitResolved.provider),
         ]
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
      explicitUsed: Boolean(explicitResolved),
   }
}

/**
 * Determine the ordered list of providers to attempt for a request.
 * If an explicit provider is given it leads the order; otherwise the
 * configured default leads. When `noFallback` is true the list is
 * truncated to just the first provider.
 * @param config - The resolved yardmaster configuration.
 * @param explicit - Optional explicit provider token from the user.
 * @param noFallback - When true, disable fallback and use only the first provider.
 * @returns The ordered provider list and whether an explicit provider was used.
 * @throws {Error} If `explicit` is not a recognized provider token.
 */
export function resolveProviderOrder(
   config: YardmasterConfig,
   explicit?: string,
   noFallback = false,
): {
   order: ProviderId[]
   explicitUsed: boolean
} {
   const { slots, explicitUsed } = resolveProviderExecutionPlan(config, explicit, noFallback)
   return {
      order: slots.map((s) => s.provider),
      explicitUsed,
   }
}
