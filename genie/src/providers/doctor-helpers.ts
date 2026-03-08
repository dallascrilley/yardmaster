import { UsageError } from '../errors.js'
import { providerIds, type ProviderId } from '../types.js'
import { getProviderAdapter, providerAdapters } from './registry.js'
import { runCommand } from './base.js'
import type { ProviderDoctorStatus } from './doctor-types.js'

export function resolveDoctorTargets(provider?: string) {
  if (provider && !providerIds.includes(provider as ProviderId)) {
    throw new UsageError(`Unknown provider '${provider}'`)
  }

  return provider
    ? [getProviderAdapter(provider as ProviderId)].filter((item): item is NonNullable<typeof item> => Boolean(item))
    : providerAdapters
}

export async function doctorProviderStatus(adapter: (typeof providerAdapters)[number]): Promise<ProviderDoctorStatus> {
  const startedAt = Date.now()
  const availability = await adapter.isAvailable(runCommand)
  let auth = { ok: false, reason: 'provider unavailable' } as Awaited<ReturnType<typeof adapter.isAuthenticated>>
  if (availability.ok) {
    auth = await adapter.isAuthenticated(runCommand)
  }

  return {
    provider: adapter.id,
    available: availability.ok,
    authenticated: availability.ok ? auth.ok : false,
    availabilityDetails: availability.details,
    authDetails: auth.details,
    hint: availability.ok ? (auth.ok ? undefined : auth.hint) : availability.hint,
    latencyMs: Date.now() - startedAt,
  }
}
