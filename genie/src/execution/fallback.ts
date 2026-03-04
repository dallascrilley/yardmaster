import { AggregatedProviderError } from '../errors.js'
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

  for (const providerId of params.order) {
    const provider = params.providers.find((entry) => entry.id === providerId)
    if (!provider) {
      failures.push(toFailureReasonForMissingProvider(providerId))
      continue
    }

    const preflightFailures = await runPreflight(provider, params.runner)
    if (preflightFailures.length > 0) {
      failures.push(...preflightFailures)
      continue
    }

    try {
      const parsed = await provider.execute(params.request, params.runner)
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
        },
      }
    } catch (error) {
      failures.push({
        provider: provider.id,
        stage: 'execution',
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  throw new AggregatedProviderError(failures)
}
