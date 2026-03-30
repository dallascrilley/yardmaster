import {
  type CommandRunner,
  type ProviderAdapter,
  type NormalizedRequest,
  type ProviderFailureReason,
} from '../types.js'
import type { GenieConfig } from '../config/schema.js'
import {
  appendExecutionFailure,
  throwForFailures,
  toFailureReasonForMissingProvider,
  toMissingProviderAttempt,
  toSuccessResult,
  type FallbackResult,
} from './fallback-helpers.js'
import type { ProviderExecutionSlot } from './provider-order.js'

function modelForAttempt(
  request: NormalizedRequest,
  slot: ProviderExecutionSlot,
  config: GenieConfig,
): string | undefined {
  if (request.model) {
    return request.model
  }
  if (slot.aliasModel) {
    return slot.aliasModel
  }
  const fromConfig = config.model.byProvider[slot.provider]
  return fromConfig && fromConfig.length > 0 ? fromConfig : undefined
}

export type ExecuteWithFallbackResult = FallbackResult & {
  winningRequest?: NormalizedRequest
}

/**
 * Try each provider in order until one succeeds. For each provider the pipeline
 * runs preflight checks (availability + auth) then execution. Failures are
 * recorded and the next provider is attempted. If all providers fail, throws
 * an {@link AggregatedProviderError} with the collected failure reasons.
 * @param params - Provider list, ordered IDs, normalized request, and command runner.
 * @returns The first successful {@link FallbackResult}.
 * @throws {AggregatedProviderError} When every provider in the order fails.
 */
export async function executeWithFallback(params: {
  providers: ProviderAdapter[]
  slots: ProviderExecutionSlot[]
  request: NormalizedRequest
  config: GenieConfig
  runner: CommandRunner
}): Promise<ExecuteWithFallbackResult> {
  const failures: ProviderFailureReason[] = []
  const attempts: FallbackResult['result']['timings']['attempts'] = []
  const requestStartedAt = Date.now()
  const order = params.slots.map((s) => s.provider)

  for (const slot of params.slots) {
    const provider = params.providers.find((entry) => entry.id === slot.provider)
    if (!provider) {
      failures.push(toFailureReasonForMissingProvider(slot.provider))
      attempts.push(toMissingProviderAttempt(slot.provider))
      continue
    }

    const attemptModel = modelForAttempt(params.request, slot, params.config)
    const attemptRequest: NormalizedRequest = {
      ...params.request,
      ...(attemptModel !== undefined ? { model: attemptModel } : {}),
    }

    const executionStartedAt = Date.now()
    try {
      const parsed = await provider.execute(attemptRequest, params.runner)
      attempts.push({
        provider: provider.id,
        stage: 'success',
        durationMs: Date.now() - executionStartedAt,
        ok: true,
      })

      const success = toSuccessResult({
        provider,
        request: attemptRequest,
        response: parsed,
        order,
        attempts,
        requestStartedAt,
      })

      return {
        ...success,
        winningRequest: attemptRequest,
      }
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
