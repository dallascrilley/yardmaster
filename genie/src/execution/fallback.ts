import { AggregatedProviderError, TimeoutError } from '../errors.js'
import {
  type CommandRunner,
  type ProviderAdapter,
  type NormalizedRequest,
  type ProviderFailureReason,
  type GenieRunResult,
  type ProviderId,
} from '../types.js'
import { runPreflight } from './preflight.js'

export type FallbackResult = {
  result: GenieRunResult
  provider: ProviderAdapter
}

function toFailureReasonForMissingProvider(providerId: string): ProviderFailureReason {
  return {
    provider: providerId as ProviderId,
    stage: 'availability',
    reason: `Unknown provider '${providerId}' in configured fallback list`,
  }
}

export async function executeWithFallback(params: {
  providers: ProviderAdapter[]
  order: ProviderId[]
  request: NormalizedRequest
  runner: CommandRunner
}): Promise<FallbackResult> {
  const failures: ProviderFailureReason[] = []
  const attempts: GenieRunResult['timings']['attempts'] = []
  const requestStartedAt = Date.now()

  for (const providerId of params.order) {
    const provider = params.providers.find((entry) => entry.id === providerId)
    if (!provider) {
      failures.push(toFailureReasonForMissingProvider(providerId))
      attempts.push({
        provider: providerId,
        stage: 'availability',
        durationMs: 0,
        ok: false,
        reason: `Unknown provider '${providerId}' in configured fallback list`,
      })
      continue
    }

    const preflightStartedAt = Date.now()
    const preflightFailures = await runPreflight(provider, params.runner)
    if (preflightFailures.length > 0) {
      const durationMs = Date.now() - preflightStartedAt
      failures.push(...preflightFailures.map((failure) => ({ ...failure, durationMs })))
      attempts.push(
        ...preflightFailures.map((failure) => ({
          provider: provider.id,
          stage: failure.stage,
          durationMs,
          ok: false,
          reason: failure.reason,
        })),
      )
      continue
    }

    const executionStartedAt = Date.now()
    try {
      const parsed = await provider.execute(params.request, params.runner)
      const durationMs = Date.now() - executionStartedAt
      attempts.push({
        provider: provider.id,
        stage: 'success',
        durationMs,
        ok: true,
      })

      return {
        provider,
        result: {
          provider: provider.id,
          model: params.request.model,
          mode: params.request.mode,
          workspace: params.request.workspace,
          trust: params.request.trust,
          response: parsed.text,
          raw: parsed.raw,
          fallbackUsed: provider.id !== params.order[0],
          timings: {
            totalMs: Date.now() - requestStartedAt,
            attempts,
          },
        },
      }
    } catch (error) {
      const durationMs = Date.now() - executionStartedAt
      const reason = error instanceof Error ? error.message : String(error)
      const timeout = /timed out|\(124\)/i.test(reason)
      failures.push({
        provider: provider.id,
        stage: 'execution',
        reason,
        durationMs,
        timeout,
      })
      attempts.push({
        provider: provider.id,
        stage: 'execution',
        durationMs,
        ok: false,
        reason,
      })
    }
  }

  if (failures.some((item) => item.timeout)) {
    throw new TimeoutError(new AggregatedProviderError(failures).message)
  }

  throw new AggregatedProviderError(failures)
}
