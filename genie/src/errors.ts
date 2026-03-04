import { type ProviderFailureReason } from './types.js'

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
