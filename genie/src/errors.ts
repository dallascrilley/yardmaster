import { type ProviderFailureReason } from './types.js'
import { usageSuggestions, withNextSteps } from './error-format.js'

export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

export class RuntimeProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeProviderError'
  }
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthConfigurationError'
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class AggregatedProviderError extends Error {
  constructor(public readonly reasons: ProviderFailureReason[]) {
    const lines = reasons
      .map((r) => `${r.provider} (${r.stage}): ${r.reason}${r.durationMs ? ` [${r.durationMs}ms]` : ''}`)
      .join('\n')
    super(`No provider succeeded.\n${lines}`)
    this.name = 'AggregatedProviderError'
  }

  hasOnlyAuthOrConfigFailures(): boolean {
    return this.reasons.length > 0 && this.reasons.every((item) => item.authFailure)
  }

  hasTimeoutFailure(): boolean {
    return this.reasons.some((item) => item.timeout)
  }
}

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
    if (error.hasOnlyAuthOrConfigFailures()) {
      return 3
    }
    if (error.hasTimeoutFailure()) {
      return 124
    }
    return 1
  }

  if (error instanceof RuntimeProviderError) {
    return 1
  }

  if (error instanceof Error && /timed out/i.test(error.message)) {
    return 124
  }

  return 1
}

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

  if (error instanceof TimeoutError || (error instanceof Error && /timed out/i.test(error.message))) {
    const message = error instanceof Error ? error.message : String(error)
    return withNextSteps(message, [
      'Retry with a higher timeout using `--timeout-ms <n>` if the provider is slow.',
      'Retry with `--no-fallback` to isolate one provider while debugging.',
    ])
  }

  if (error instanceof UsageError) {
    return withNextSteps(error.message, usageSuggestions(error.message))
  }

  if (error instanceof Error) {
    return withNextSteps(error.message, ['Run `genie help` if you need to verify command syntax before retrying.'])
  }

  return String(error)
}
