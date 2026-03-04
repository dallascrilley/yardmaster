import { type CommandRunner, type NormalizedRequest, type GenieRunResult, type ProviderId } from '../types.js'
import { resolveProviderOrder, normalizeRequest, type NormalizedPromptRequest } from './normalize.js'
import { executeWithFallback } from './fallback.js'
import { providerAdapters } from '../providers/registry.js'
import { defaultConfig, type GenieConfig } from '../config/schema.js'
import { updateConfig } from '../config/store.js'
import { runCommand } from '../providers/base.js'

export type RunRequestInput = {
  prompt: string
  provider?: ProviderId
  model?: string
  workspace?: string
  mode?: string
  trust?: boolean
  output?: 'auto' | 'pretty' | 'json'
}

export async function runRequest(params: {
  input: RunRequestInput
  config: GenieConfig
  runner?: CommandRunner
}): Promise<GenieRunResult> {
  const runner = params.runner ?? runCommand
  const request: NormalizedRequest = normalizeRequest(params.input, params.config)
  const { order } = resolveProviderOrder(params.config, request.provider)

  const result = await executeWithFallback({
    providers: providerAdapters,
    order,
    request,
    runner,
  })

  await updateConfig((current) => {
    const byProvider = {
      ...current.model.byProvider,
      ...(request.model && { [result.provider.id]: request.model }),
    }

    return {
      provider: {
        ...current.provider,
        default: result.provider.id,
      },
      model: {
        byProvider,
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
      _meta: current._meta,
    }
  })

  return {
    ...result.result,
    model: request.model ?? defaultConfig.model.byProvider[result.provider.id],
    workspace: request.workspace,
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
    fallbackUsed: result.fallbackUsed,
  }
}

export function isNormalizedPromptRequest(value: unknown): value is NormalizedPromptRequest {
  try {
    normalizeRequest(value as RunRequestInput, defaultConfig)
    return true
  } catch {
    return false
  }
}
