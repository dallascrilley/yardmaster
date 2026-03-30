import { UsageError } from '../errors.js'
import { isConfigProviderId, resolveConfigProviderToken } from '../execution/provider-aliases.js'
import { getProviderAdapter, providerAdapters } from './registry.js'
import { runCommand } from './base.js'
import type { ProviderDoctorStatus } from './doctor-types.js'

export function resolveDoctorTargets(provider?: string) {
  if (provider && !isConfigProviderId(provider)) {
    throw new UsageError(`Unknown provider '${provider}'`)
  }

  if (!provider) {
    return providerAdapters
  }

  const canonical = resolveConfigProviderToken(provider).provider
  const adapter = getProviderAdapter(canonical)
  if (!adapter) {
    throw new UsageError(`No adapter registered for '${provider}'`)
  }

  return [adapter]
}

export async function doctorProviderStatus(adapter: (typeof providerAdapters)[number]): Promise<ProviderDoctorStatus> {
  const startedAt = Date.now()
  const availability = await adapter.isAvailable(runCommand)
  let auth = { ok: false, reason: 'provider unavailable' } as Awaited<ReturnType<typeof adapter.isAuthenticated>>
  if (availability.ok) {
    auth = await adapter.isAuthenticated(runCommand, { workspace: process.cwd() })
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
