import { type CommandRunner, type NormalizedRequest, type GenieRunResult, type ProviderId } from '../types.js'
import { resolveProviderOrder, normalizeRequest } from './normalize.js'
import { executeWithFallback } from './fallback.js'
import { providerAdapters } from '../providers/registry.js'
import { type GenieConfig, defaultConfig } from '../config/schema.js'
import { updateConfig } from '../config/store.js'
import { AggregatedProviderError } from '../errors.js'

export async function runRequest(params: {
  input: {
    prompt: string
    provider?: ProviderId
    model?: string
    workspace?: string
    mode?: string
    trust?: boolean
    output?: 'auto' | 'pretty' | 'json'
  }
  config: GenieConfig
  runner: CommandRunner
}): Promise<GenieRunResult> {
  const request: NormalizedRequest = normalizeRequest(params.input, params.config)
  const { order } = resolveProviderOrder(params.config, request.provider)
  const result = await executeWithFallback({
    providers: providerAdapters,
    order,
    request,
    runner: params.runner,
  })

  const saved = await updateConfig((current) => {
    const nextModel = {
      ...current.model.byProvider,
      [result.provider.id]: request.model ?? defaultConfig.model.byProvider[result.provider.id] ?? '',
    }

    return {
      ...current,
      provider: {
        ...current.provider,
        default: result.provider.id,
      },
      model: {
        byProvider: nextModel,
      },
      mode: {
        default: request.mode,
      },
      workspace: {
        last: request.workspace,
      },
      output: {
        default: request.output,
      },
      trust: {
        default: request.trust,
      },
    }
  })

  return {
    ...result.result,
    workspace: saved.workspace.last ?? request.workspace,
  }
}

export function toResponseEnvelope(result: GenieRunResult) {
  return {
    provider: result.provider,
    model: result.model,
    mode: result.mode,
    workspace: result.workspace,
    trust: result.trust,
    response: result.response,
  }
}
