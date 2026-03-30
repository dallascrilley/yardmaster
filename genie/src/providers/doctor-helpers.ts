import { UsageError } from '../errors.js'
import { isConfigProviderId, resolveConfigProviderToken } from '../execution/provider-aliases.js'
import { type ProviderCheckResult, type ProviderId } from '../types.js'
import { runCommand } from './base.js'
import { createDefaultAvailabilityCheck, createDefaultAuthCheck } from './default-checks.js'
import type { ProviderDoctorStatus } from './doctor-types.js'

type DoctorTarget = {
  id: ProviderId
  binary: string
  resolveAuthHint?: (result: Extract<ProviderCheckResult, { ok: false }>) => string | undefined
}

function resolveCursorAgentAuthHint(result: Extract<ProviderCheckResult, { ok: false }>): string | undefined {
  const signal = [result.reason, result.details, result.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n')
    .toLowerCase()

  if (result.timeout || signal.includes('trust') || signal.includes('approve') || signal.includes('workspace')) {
    return 'cursor-agent did not respond to `auth status`. Open Cursor and trust/approve this workspace for agent access before retrying.'
  }

  if (signal.includes('login') || signal.includes('log in') || signal.includes('sign in') || signal.includes('authenticated') || signal.includes('auth')) {
    return 'cursor-agent is not authenticated. Open Cursor, sign in to your account, then retry.'
  }

  return result.hint
}

const doctorTargets: DoctorTarget[] = [
  { id: 'claude', binary: 'claude' },
  { id: 'codex', binary: 'codex' },
  {
    id: 'cursor-agent',
    binary: 'cursor-agent',
    resolveAuthHint: resolveCursorAgentAuthHint,
  },
  { id: 'gemini', binary: 'gemini' },
]

function getDoctorTarget(id: ProviderId): DoctorTarget | undefined {
  return doctorTargets.find((entry) => entry.id === id)
}

export function resolveDoctorTargets(provider?: string) {
  if (provider && !isConfigProviderId(provider)) {
    throw new UsageError(`Unknown provider '${provider}'`)
  }

  if (!provider) {
    return doctorTargets
  }

  const canonical = resolveConfigProviderToken(provider).provider
  const entry = getDoctorTarget(canonical)
  if (!entry) {
    throw new UsageError(`No adapter registered for '${provider}'`)
  }

  return [entry]
}

export async function doctorProviderStatus(entry: DoctorTarget): Promise<ProviderDoctorStatus> {
  const startedAt = Date.now()
  const availability = await createDefaultAvailabilityCheck(entry.binary)(runCommand)
  let authenticated = false
  let authDetails: string | undefined
  let hint = availability.ok ? undefined : availability.hint

  if (availability.ok) {
    const auth = await createDefaultAuthCheck(entry.id, entry.binary)(runCommand)
    authenticated = auth.ok
    authDetails = auth.ok
      ? auth.details
      : auth.timeout
        ? auth.hint
        : auth.details ?? auth.reason
    if (!auth.ok) {
      hint = entry.resolveAuthHint?.(auth) ?? auth.hint
    }
  }

  return {
    provider: entry.id,
    available: availability.ok,
    authenticated,
    availabilityDetails: availability.ok ? availability.details : availability.reason,
    authDetails,
    hint,
    latencyMs: Date.now() - startedAt,
  }
}
