import {
  type CommandRunner,
  type ProviderAdapter,
  type NormalizedRequest,
  type ProviderFailureReason,
  type ProviderId,
} from '../types.js'
import { runPreflight } from './preflight.js'
import {
  appendExecutionFailure,
  appendPreflightFailures,
  throwForFailures,
  toFailureReasonForMissingProvider,
  toMissingProviderAttempt,
  toSuccessResult,
  type FallbackResult,
} from './fallback-helpers.js'

export async function executeWithFallback(params: {
  providers: ProviderAdapter[]
  order: ProviderId[]
  request: NormalizedRequest
  runner: CommandRunner
}): Promise<FallbackResult> {
  const failures: ProviderFailureReason[] = []
  const attempts: FallbackResult['result']['timings']['attempts'] = []
  const requestStartedAt = Date.now()

  for (const providerId of params.order) {
    const provider = params.providers.find((entry) => entry.id === providerId)
    if (!provider) {
      failures.push(toFailureReasonForMissingProvider(providerId))
      attempts.push(toMissingProviderAttempt(providerId))
      continue
    }

    const preflightStartedAt = Date.now()
    const preflightFailures = await runPreflight(provider, params.runner)
    if (preflightFailures.length > 0) {
      appendPreflightFailures({
        failures,
        attempts,
        providerId: provider.id,
        durationMs: Date.now() - preflightStartedAt,
        preflightFailures,
      })
      continue
    }

    const executionStartedAt = Date.now()
    try {
      const parsed = await provider.execute(params.request, params.runner)
      attempts.push({
        provider: provider.id,
        stage: 'success',
        durationMs: Date.now() - executionStartedAt,
        ok: true,
      })

      return toSuccessResult({
        provider,
        request: params.request,
        response: parsed,
        order: params.order,
        attempts,
        requestStartedAt,
      })
    } catch (error) {
      appendExecutionFailure({
        failures,
        attempts,
        providerId: provider.id,
        durationMs: Date.now() - executionStartedAt,
        error,
      })
    }
  }

  throwForFailures(failures)
}
