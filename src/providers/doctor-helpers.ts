import { resolveCursorCliCommand } from '../acp/provider-registry.js'
import { UsageError } from '../errors.js'
import { isConfigProviderId, resolveConfigProviderToken } from '../execution/provider-aliases.js'
import { type ProviderCheckResult, type ProviderId } from '../types.js'
import { runCommand } from './base.js'
import { codexAuthCheck } from './codex-auth.js'
import {
  createCursorCliAuthCheck,
  createDefaultAvailabilityCheck,
  createDefaultAuthCheck,
} from './default-checks.js'
import type { DoctorOptions, ProviderDoctorStatus } from './doctor-types.js'
import { redactIdentity } from './redact.js'

type DoctorTarget = {
  id: ProviderId
  binary: string
  resolveAuthHint?: (result: Extract<ProviderCheckResult, { ok: false }>) => string | undefined
  /** Use `agent --version` / `agent status` — same binary as ACP `agent acp`. */
  cursorCliDoctor?: true
  /** Codex changed its auth subcommand; use the version-tolerant probe. */
  codexDoctor?: true
}

function resolveCursorAgentAuthHint(result: Extract<ProviderCheckResult, { ok: false }>): string | undefined {
  const signal = [result.reason, result.details, result.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n')
    .toLowerCase()

  if (result.timeout || signal.includes('trust') || signal.includes('approve') || signal.includes('workspace')) {
    return 'The Cursor CLI (`agent`) did not respond to `agent status`. Open Cursor and trust/approve this workspace, or run `agent login` if you are not signed in.'
  }

  if (signal.includes('login') || signal.includes('log in') || signal.includes('sign in') || signal.includes('authenticated') || signal.includes('auth')) {
    return 'The Cursor CLI is not authenticated. Run `agent login` or open Cursor and sign in, then retry.'
  }

  return result.hint
}

const doctorTargets: DoctorTarget[] = [
  { id: 'claude', binary: 'claude' },
  { id: 'codex', binary: 'codex', codexDoctor: true },
  {
    id: 'cursor-agent',
    binary: 'agent',
    resolveAuthHint: resolveCursorAgentAuthHint,
    cursorCliDoctor: true,
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

function resolveAuthCheck(entry: DoctorTarget, command: string) {
  if (entry.cursorCliDoctor) return createCursorCliAuthCheck(command)
  if (entry.codexDoctor) return codexAuthCheck
  return createDefaultAuthCheck(entry.id, entry.binary)
}

export async function doctorProviderStatus(
  entry: DoctorTarget,
  options: DoctorOptions = {},
): Promise<ProviderDoctorStatus> {
  const startedAt = Date.now()
  const command = entry.cursorCliDoctor ? resolveCursorCliCommand() : entry.binary
  const availability = await createDefaultAvailabilityCheck(command)(runCommand)
  let authenticated = false
  let authDetails: string | undefined
  let hint = availability.ok ? undefined : availability.hint

  if (availability.ok) {
    const auth = await resolveAuthCheck(entry, command)(runCommand)
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

  // Provider CLIs print the signed-in operator (`claude auth status` returns
  // email/orgId/orgName). Redact unless the caller explicitly opted in.
  const scrub = options.showIdentity ? (value: string | undefined) => value : redactIdentity

  return {
    provider: entry.id,
    available: availability.ok,
    authenticated,
    availabilityDetails: scrub(availability.ok ? availability.details : availability.reason),
    authDetails: scrub(authDetails),
    hint: scrub(hint),
    identityRedacted: !options.showIdentity,
    latencyMs: Date.now() - startedAt,
  }
}
