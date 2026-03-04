import {
  type ProviderAdapter,
  type ProviderCheckResult,
  type CommandRunner,
  type ProviderFailureReason,
} from '../types.js'

export function formatReason(id: string, check: ProviderCheckResult, stage: ProviderFailureReason['stage']): ProviderFailureReason {
  if (check.ok) {
    throw new Error('No reason for successful check')
  }

  return {
    provider: id as ProviderFailureReason['provider'],
    stage,
    reason: check.reason,
    hint: check.hint,
  }
}

export async function runPreflight(
  provider: ProviderAdapter,
  runner: CommandRunner,
): Promise<{ failures: ProviderFailureReason[] }> {
  const failures: ProviderFailureReason[] = []

  const available = await provider.isAvailable(runner)
  if (!available.ok) {
    failures.push(formatReason(provider.id, available, 'availability'))
    return { failures }
  }

  const auth = await provider.isAuthenticated(runner)
  if (!auth.ok) {
    failures.push(formatReason(provider.id, auth, 'auth'))
    return { failures }
  }

  return { failures: [] }
}
