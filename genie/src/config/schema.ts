import { z } from 'zod'
import { cliOutputModeSchema, providerIds } from '../types.js'

export const modelMapSchema = z.record(z.string(), z.string()).default({})

export const genieConfigSchema = z.object({
  provider: z.object({
    default: z.enum(providerIds).default('claude'),
    fallbackOrder: z
      .array(z.enum(providerIds))
      .default([...providerIds]),
  }),
  model: z.object({ byProvider: modelMapSchema }),
  mode: z.object({
    default: z.string().trim().min(1).default('default'),
  }),
  workspace: z.object({
    last: z.string().trim().optional(),
  }),
  output: z.object({
    default: cliOutputModeSchema.default('auto'),
  }),
  trust: z.object({
    default: z.boolean().default(false),
  }),
  _meta: z
    .object({
      schema: z.string().optional(),
      savedAt: z.string().optional(),
    })
    .partial()
    .optional(),
})

export type GenieConfig = z.infer<typeof genieConfigSchema>

export const defaultConfig: GenieConfig = {
  provider: {
    default: 'claude',
    fallbackOrder: [...providerIds],
  },
  model: {
    byProvider: {},
  },
  mode: {
    default: 'default',
  },
  workspace: {
    last: undefined,
  },
  output: {
    default: 'auto',
  },
  trust: {
    default: false,
  },
}

export function mergeConfig(base: GenieConfig, updates: Partial<GenieConfig>): GenieConfig {
  return {
    provider: {
      default: updates.provider?.default ?? base.provider.default,
      fallbackOrder:
        updates.provider?.fallbackOrder && updates.provider.fallbackOrder.length > 0
          ? updates.provider.fallbackOrder
          : base.provider.fallbackOrder,
    },
    model: {
      byProvider: {
        ...(base.model?.byProvider ?? {}),
        ...(updates.model?.byProvider ?? {}),
      },
    },
    mode: {
      default: updates.mode?.default ?? base.mode.default,
    },
    workspace: {
      last: updates.workspace?.last ?? base.workspace.last,
    },
    output: {
      default: updates.output?.default ?? base.output.default,
    },
    trust: {
      default: updates.trust?.default ?? base.trust.default,
    },
    _meta: updates._meta ?? base._meta,
  }
}
