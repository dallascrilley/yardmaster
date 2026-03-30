import { z } from 'zod'

import type { GenieConfig } from '../config/schema.js'
import { isConfigProviderId, resolveConfigProviderToken } from './provider-aliases.js'
import {
  modeIds,
  providerIds,
  type CliOutputMode,
  type NormalizedRequest,
  type ProviderId,
} from '../types.js'

const DEFAULT_TIMEOUT_MS = 120_000

export const requestSchema = z.object({
  prompt: z.string().trim().min(1),
  provider: z.enum(providerIds).optional(),
  model: z.string().trim().optional(),
  workspace: z.string().trim().min(1),
  mode: z.enum(modeIds).default('default'),
  trust: z.boolean().default(false),
  output: z.enum(['auto', 'pretty', 'json', 'plain']).default('auto'),
  timeoutMs: z.number().int().positive().max(300_000).default(DEFAULT_TIMEOUT_MS),
  noFallback: z.boolean().default(false),
  yolo: z.boolean().default(false),
  includeDirectories: z.array(z.string().trim().min(1)).default([]),
  outputFormat: z.enum(['text', 'json', 'stream-json']).default('text'),
  headless: z.boolean().default(true),
  extensions: z.array(z.string().trim().min(1)).default([]),
  mcp: z.array(z.string().trim().min(1)).default([]),
})

export type NormalizedPromptRequest = z.infer<typeof requestSchema>

export type NormalizeRequestInput = {
  prompt: string
  provider?: string
  model?: string
  workspace?: string
  mode?: string
  trust?: boolean
  output?: CliOutputMode
  timeoutMs?: number
  noFallback?: boolean
  yolo?: boolean
  includeDirectories?: string[]
  outputFormat?: 'text' | 'json' | 'stream-json'
  headless?: boolean
  extensions?: string[]
  mcp?: string[]
}

export function normalizeRequest(
  input: NormalizeRequestInput,
  config: GenieConfig,
): NormalizedRequest {
  let effectiveProvider = input.provider?.trim().toLowerCase()
  let effectiveModel = input.model?.trim() || undefined

  if (effectiveProvider && isConfigProviderId(effectiveProvider)) {
    const { provider, aliasModel } = resolveConfigProviderToken(effectiveProvider)
    if (!effectiveModel && aliasModel) {
      effectiveModel = aliasModel
    }
    effectiveProvider = provider
  }

  return requestSchema.parse({
    prompt: input.prompt,
    provider: effectiveProvider as ProviderId | undefined,
    model: effectiveModel,
    workspace: input.workspace || config.workspace.last || process.cwd(),
    mode: input.mode || config.mode.default,
    trust: input.trust ?? config.trust.default,
    output: input.output || config.output.default,
    timeoutMs: input.timeoutMs ?? config.runtime.timeoutMs,
    noFallback: input.noFallback ?? false,
    yolo: input.yolo ?? false,
    includeDirectories: input.includeDirectories ?? [],
    outputFormat: input.outputFormat ?? 'text',
    headless: input.headless ?? true,
    extensions: input.extensions ?? [],
    mcp: input.mcp ?? [],
  })
}
