import {
  type ProviderAdapter,
  type ProviderCheckResult,
  type CommandRunner,
  type ProviderFailureReason,
} from '../types.js'

export function formatFailureReason(
  providerId: string,
  check: ProviderCheckResult,
  stage: ProviderFailureReason['stage'],
): ProviderFailureReason {
  if (check.ok) {
    throw new Error('formatFailureReason called with successful check')
  }

  return {
    provider: providerId as ProviderFailureReason['provider'],
    stage,
    reason: check.reason,
    hint: check.hint,
  }
}

export async function runPreflight(
  provider: ProviderAdapter,
  runner: CommandRunner,
): Promise<ProviderFailureReason[]> {
  const failures: ProviderFailureReason[] = []

  const availability = await provider.isAvailable(runner)
  if (!availability.ok) {
    failures.push(formatFailureReason(provider.id, availability, 'availability'))
    return failures
  }

  const auth = await provider.isAuthenticated(runner)
  if (!auth.ok) {
    failures.push(formatFailureReason(provider.id, auth, 'auth'))
  }

  return failures
}
