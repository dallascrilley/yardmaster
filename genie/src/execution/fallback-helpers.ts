import { AggregatedProviderError, TimeoutError } from '../errors.js'
import {
  type GenieRunResult,
  type ProviderAdapter,
  type ProviderFailureReason,
  type ProviderId,
} from '../types.js'

export type FallbackResult = {
  result: GenieRunResult
  provider: ProviderAdapter
}

export function toFailureReasonForMissingProvider(providerId: ProviderId): ProviderFailureReason {
  return {
    provider: providerId,
    stage: 'availability',
    reason: `Unknown provider '${providerId}' in configured fallback list`,
  }
}

export function toMissingProviderAttempt(providerId: ProviderId): GenieRunResult['timings']['attempts'][number] {
  return {
    provider: providerId,
    stage: 'availability',
    durationMs: 0,
    ok: false,
    reason: `Unknown provider '${providerId}' in configured fallback list`,
  }
}

export function appendPreflightFailures(params: {
  failures: ProviderFailureReason[]
  attempts: GenieRunResult['timings']['attempts']
  providerId: ProviderId
  durationMs: number
  preflightFailures: ProviderFailureReason[]
}): void {
  params.failures.push(...params.preflightFailures.map((failure) => ({ ...failure, durationMs: params.durationMs })))
  params.attempts.push(
    ...params.preflightFailures.map((failure) => ({
      provider: params.providerId,
      stage: failure.stage,
      durationMs: params.durationMs,
      ok: false,
      reason: failure.reason,
    })),
  )
}

export function toSuccessResult(params: {
  provider: ProviderAdapter
  request: {
    model?: string
    mode: string
    workspace: string
    trust: boolean
  }
  response: {
    text: string
    raw: GenieRunResult['raw']
  }
  order: ProviderId[]
  attempts: GenieRunResult['timings']['attempts']
  requestStartedAt: number
}): FallbackResult {
  return {
    provider: params.provider,
    result: {
      provider: params.provider.id,
      model: params.request.model,
      mode: params.request.mode,
      workspace: params.request.workspace,
      trust: params.request.trust,
      response: params.response.text,
      raw: params.response.raw,
      fallbackUsed: params.provider.id !== params.order[0],
      timings: {
        totalMs: Date.now() - params.requestStartedAt,
        attempts: params.attempts,
      },
    },
  }
}

export function appendExecutionFailure(params: {
  failures: ProviderFailureReason[]
  attempts: GenieRunResult['timings']['attempts']
  providerId: ProviderId
  durationMs: number
  error: unknown
}): void {
  const reason = params.error instanceof Error ? params.error.message : String(params.error)
  const timeout = /timed out|\(124\)/i.test(reason)
  params.failures.push({
    provider: params.providerId,
    stage: 'execution',
    reason,
    durationMs: params.durationMs,
    timeout,
  })
  params.attempts.push({
    provider: params.providerId,
    stage: 'execution',
    durationMs: params.durationMs,
    ok: false,
    reason,
  })
}

export function throwForFailures(failures: ProviderFailureReason[]): never {
  if (failures.some((item) => item.timeout)) {
    const aggregated = new AggregatedProviderError(failures)
    throw new TimeoutError(aggregated.message, failures)
  }

  throw new AggregatedProviderError(failures)
}
