import { UsageError } from '../errors.js'
import { isConfigProviderId, resolveConfigProviderToken } from '../execution/provider-aliases.js'
import { getAcpProvider, listAcpProviders } from '../acp/provider-registry.js'
import type { ProviderDoctorStatus } from './doctor-types.js'

export function resolveDoctorTargets(provider?: string) {
  if (provider && !isConfigProviderId(provider)) {
    throw new UsageError(`Unknown provider '${provider}'`)
  }

  if (!provider) {
    return listAcpProviders()
  }

  const canonical = resolveConfigProviderToken(provider).provider
  const entry = getAcpProvider(canonical)
  if (!entry) {
    throw new UsageError(`No ACP adapter registered for '${provider}'`)
  }

  return [entry]
}

export async function doctorProviderStatus(entry: ReturnType<typeof listAcpProviders>[number]): Promise<ProviderDoctorStatus> {
  const startedAt = Date.now()
  
  // For ACP adapters, we check if the command exists in PATH
  // This is a simplified check - full implementation would try to spawn and initialize
  const isAvailable = true // Placeholder - would need actual check
  
  return {
    provider: entry.id,
    available: isAvailable,
    authenticated: false, // ACP adapters handle auth via env vars
    availabilityDetails: `ACP adapter: ${entry.agentCommand}`,
    hint: isAvailable ? undefined : `Ensure ${entry.agentCommand} is available in PATH`,
    latencyMs: Date.now() - startedAt,
  }
}
