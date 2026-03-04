import { z } from 'dc-cli-kit'

import { type NormalizedRequest, providerIds, type CliOutputMode } from '../types.js'
import type { GenieConfig } from '../config/schema.js'

export const requestSchema = z.object({
  prompt: z.string().trim().min(1),
  provider: z.enum(providerIds).optional(),
  model: z.string().trim().optional(),
  workspace: z.string().trim().min(1),
  mode: z.string().trim().min(1).default('default'),
  trust: z.boolean().default(false),
  output: z.enum(['auto', 'pretty', 'json']).default('auto'),
})

export type NormalizedPromptRequest = z.infer<typeof requestSchema>

export function normalizeRequest(
  input: {
    prompt: string
    provider?: string
    model?: string
    workspace?: string
    mode?: string
    trust?: boolean
    output?: CliOutputMode
  },
  config: GenieConfig,
): NormalizedRequest {
  const parsed = requestSchema.parse({
    prompt: input.prompt,
    provider: input.provider,
    model: input.model,
    workspace: input.workspace || config.workspace.last || process.cwd(),
    mode: input.mode || config.mode.default,
    trust: input.trust ?? config.trust.default,
    output: input.output || config.output.default,
  })

  return parsed
}

export function resolveProviderOrder(config: GenieConfig, explicit?: string): {
  order: string[]
  explicitUsed: boolean
} {
  if (explicit && config.provider.fallbackOrder.includes(explicit as any)) {
    return {
      order: [explicit as any, ...config.provider.fallbackOrder.filter((id) => id !== explicit)],
      explicitUsed: true,
    }
  }

  if (explicit) {
    return {
      order: [explicit, ...config.provider.fallbackOrder.filter((id) => id !== explicit)],
      explicitUsed: true,
    }
  }

  const order = [config.provider.default, ...config.provider.fallbackOrder.filter((id) => id !== config.provider.default)]
  return { order, explicitUsed: false }
}
