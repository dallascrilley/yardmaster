import { type CommandRunner, type NormalizedRequest, type GenieRunResult, type ProviderId, type GenieResponseEnvelope } from '../types.js'
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
  output?: 'auto' | 'pretty' | 'json' | 'plain'
  timeoutMs?: number
  noFallback?: boolean
  yolo?: boolean
  includeDirectories?: string[]
  outputFormat?: 'text' | 'json' | 'stream-json'
  headless?: boolean
  extensions?: string[]
  mcp?: string[]
}

export async function runRequest(params: {
  input: RunRequestInput
  config: GenieConfig
  runner?: CommandRunner
  persistLastUsed?: boolean
}): Promise<GenieRunResult> {
  const runner = params.runner ?? runCommand
  const persistLastUsed = params.persistLastUsed ?? true
  const request: NormalizedRequest = normalizeRequest(params.input, params.config)
  const { order } = resolveProviderOrder(params.config, request.provider, request.noFallback)

  const result = await executeWithFallback({
    providers: providerAdapters,
    order,
    request,
    runner,
  })

  if (persistLastUsed) {
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
        runtime: {
          timeoutMs: request.timeoutMs,
        },
        presets: current.presets,
        _meta: current._meta,
      }
    })
  }

  return {
    ...result.result,
    model: request.model ?? defaultConfig.model.byProvider[result.provider.id],
    workspace: request.workspace,
  }
}

export function toResponseEnvelope(result: GenieRunResult): GenieResponseEnvelope {
  return {
    provider: result.provider,
    model: result.model ?? null,
    response: result.response,
    fallbackUsed: result.fallbackUsed,
    timings: result.timings,
    error: null,
  }
}

export function toErrorEnvelope(error: { code: string; message: string }, timings?: GenieRunResult['timings']): GenieResponseEnvelope {
  return {
    provider: null,
    model: null,
    response: '',
    fallbackUsed: false,
    timings: timings ?? {
      totalMs: 0,
      attempts: [],
    },
    error,
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
