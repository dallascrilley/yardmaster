import { type ProviderFailureReason } from './types.js'
import { usageSuggestions, withNextSteps } from './error-format.js'

/** Thrown when the user supplies invalid CLI arguments or an unknown command. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

/** Thrown when a provider CLI fails during execution (non-zero exit, unexpected output). */
export class RuntimeProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeProviderError'
  }
}

/** Thrown when a provider's authentication or configuration check fails. */
export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthConfigurationError'
  }
}

/** Thrown when a provider command exceeds its configured timeout. */
export class TimeoutError extends Error {
  public readonly reasons?: ProviderFailureReason[]

  constructor(message: string, reasons?: ProviderFailureReason[]) {
    super(message)
    this.name = 'TimeoutError'
    this.reasons = reasons
  }
}

export class AcpProtocolError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly providerId: string,
  ) {
    super(`ACP error ${code} from ${providerId}: ${message}`)
    this.name = 'AcpProtocolError'
  }
}

/**
 * Thrown when every provider in the fallback chain fails. Collects
 * individual {@link ProviderFailureReason} entries for diagnostics.
 */
export class AggregatedProviderError extends Error {
  constructor(public readonly reasons: ProviderFailureReason[]) {
    const lines = reasons
      .map((r) => `${r.provider} (${r.stage}): ${r.reason}${r.durationMs ? ` [${r.durationMs}ms]` : ''}`)
      .join('\n')
    super(`No provider succeeded.\n${lines}`)
    this.name = 'AggregatedProviderError'
  }

  /** Returns `true` when every failure in the chain was auth-related. */
  hasOnlyAuthFailures(): boolean {
    return this.reasons.length > 0 && this.reasons.every((item) => item.authFailure)
  }

  /** Returns `true` if at least one provider timed out. */
  hasTimeoutFailure(): boolean {
    return this.reasons.some((item) => item.timeout)
  }
}

/**
 * Map an error to the appropriate CLI exit code.
 * @param error - The caught error instance.
 * @returns A numeric exit code (2 = usage, 3 = auth, 124 = timeout, 1 = general).
 */
export function getExitCode(error: unknown): number {
  if (error instanceof UsageError) {
    return 2
  }

  if (error instanceof TimeoutError) {
    return 124
  }

  if (error instanceof AuthConfigurationError) {
    return 3
  }

  if (error instanceof AggregatedProviderError) {
    if (error.hasOnlyAuthFailures()) {
      return 3
    }
    if (error.hasTimeoutFailure()) {
      return 124
    }
    return 1
  }

  if (error instanceof AcpProtocolError) {
    if (error.code === -32000) return 3  // auth required
    return 1
  }

  if (error instanceof RuntimeProviderError) {
    return 1
  }

  return 1
}

/**
 * Format an error into a user-facing CLI message with contextual next-step suggestions.
 * @param error - The caught error instance.
 * @returns A formatted multi-line string suitable for stderr output.
 */
export function formatCliError(error: unknown): string {
  if (error instanceof AggregatedProviderError) {
    const lines = [
      'All providers failed. Enable a configured provider and try again.',
      ...error.reasons.map((r) => `- ${r.provider} (${r.stage}): ${r.reason}${r.hint ? ` — ${r.hint}` : ''}`),
    ]
    return withNextSteps(lines.join('\n'), [
      'Run `genie providers doctor` to check installation and authentication state.',
      'Retry with `genie run --provider <id> --no-fallback "<prompt>"` once one provider is healthy.',
    ])
  }

  if (error instanceof AuthConfigurationError) {
    return withNextSteps(error.message, [
      'Run `genie providers doctor` to see which auth check is failing.',
      'Authenticate the failing provider CLI, then retry the original command.',
    ])
  }

  if (error instanceof TimeoutError) {
    const lines =
      error.reasons && error.reasons.length > 0
        ? error.reasons.map((r) => `- ${r.provider} (${r.stage}): ${r.reason}${r.hint ? ` — ${r.hint}` : ''}`)
        : []
    const message = error.message
    const body =
      lines.length > 0 ? [message, ...lines].join('\n') : message
    return withNextSteps(body, [
      'Retry with a higher timeout using `--timeout-ms <n>` if the provider is slow.',
      'Retry with `--no-fallback` to isolate one provider while debugging.',
    ])
  }

  if (error instanceof UsageError) {
    return withNextSteps(error.message, usageSuggestions(error.message))
  }

  if (error instanceof AcpProtocolError) {
    return withNextSteps(`ACP protocol error from ${error.providerId}: ${error.message}`, [
      'Run `genie providers doctor` to check adapter health.',
      'Retry with `--provider <id>` to try a different provider.',
    ])
  }

  if (error instanceof Error) {
    return withNextSteps(error.message, ['Run `genie help` if you need to verify command syntax before retrying.'])
  }

  return String(error)
}
