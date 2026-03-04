import { runCommand } from './base.js'
import { providerAdapters, getProviderAdapter } from './registry.js'
import { UsageError } from '../errors.js'
import { providerIds, type ProviderId } from '../types.js'

export type ProviderDoctorStatus = {
  provider: ProviderId
  available: boolean
  authenticated: boolean
  availabilityDetails?: string
  authDetails?: string
  hint?: string
  latencyMs: number
}

export async function listProviders(): Promise<Array<{ id: ProviderId }>> {
  return providerAdapters.map((adapter) => ({ id: adapter.id }))
}

export async function doctorProviders(provider?: string): Promise<ProviderDoctorStatus[]> {
  if (provider && !providerIds.includes(provider as ProviderId)) {
    throw new UsageError(`Unknown provider '${provider}'`)
  }

  const targets = provider
    ? [getProviderAdapter(provider as ProviderId)].filter((item): item is NonNullable<typeof item> => Boolean(item))
    : providerAdapters

  const statuses: ProviderDoctorStatus[] = []

  for (const adapter of targets) {
    const startedAt = Date.now()
    const availability = await adapter.isAvailable(runCommand)
    let auth = { ok: false, reason: 'provider unavailable' } as Awaited<ReturnType<typeof adapter.isAuthenticated>>
    if (availability.ok) {
      auth = await adapter.isAuthenticated(runCommand)
    }

    statuses.push({
      provider: adapter.id,
      available: availability.ok,
      authenticated: availability.ok ? auth.ok : false,
      availabilityDetails: availability.details,
      authDetails: auth.details,
      hint: availability.ok ? (auth.ok ? undefined : auth.hint) : availability.hint,
      latencyMs: Date.now() - startedAt,
    })
  }

  return statuses
}
