import { type CommandRunner, type NormalizedRequest, type GenieRunResult } from '../types.js'
import { normalizeRequest, resolveProviderExecutionPlan } from './normalize.js'
import { executeWithFallback } from './fallback.js'
import { providerAdapters } from '../providers/registry.js'
import { type GenieConfig } from '../config/schema.js'
import { runCommand } from '../providers/base.js'
import { isNormalizedPromptRequest, toErrorEnvelope, toResponseEnvelope } from './envelopes.js'
import { persistLastUsedConfig, resolveResultModel } from './persist.js'

export type RunRequestInput = {
  prompt: string
  provider?: string
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
  const { slots } = resolveProviderExecutionPlan(params.config, request.provider, request.noFallback)

  const result = await executeWithFallback({
    providers: providerAdapters,
    slots,
    request,
    config: params.config,
    runner,
  })

  const persistRequest = result.winningRequest ?? request

  if (persistLastUsed) {
    try {
      await persistLastUsedConfig({
        request: persistRequest,
        providerId: result.provider.id,
      })
    } catch {
      process.stderr.write('Warning: failed to persist last-used config\n')
    }
  }

  return {
    ...result.result,
    model: resolveResultModel({
      request: persistRequest,
      providerId: result.provider.id,
    }),
    workspace: request.workspace,
  }
}

export { isNormalizedPromptRequest, toErrorEnvelope, toResponseEnvelope }
