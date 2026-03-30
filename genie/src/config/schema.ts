import { z } from 'zod'
import { cliOutputModeSchema, providerIds } from '../types.js'

export const modelMapSchema = z.record(z.string(), z.string()).default({})
export const providerOutputFormatSchema = z.enum(['text', 'json', 'stream-json'])
export const presetSchema = z.object({
  provider: z.enum(providerIds).optional(),
  model: z.string().trim().min(1).optional(),
  mode: z.string().trim().min(1).optional(),
  trust: z.boolean().optional(),
  yolo: z.boolean().optional(),
  headless: z.boolean().optional(),
  includeDirectories: z.array(z.string().trim().min(1)).default([]),
  outputFormat: providerOutputFormatSchema.optional(),
  extensions: z.array(z.string().trim().min(1)).default([]),
  mcp: z.array(z.string().trim().min(1)).default([]),
})

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
  runtime: z.object({
    timeoutMs: z.number().int().positive().max(300_000).default(120_000),
  }),
  presets: z.object({
    default: z.string().trim().min(1).optional(),
    named: z.record(z.string(), presetSchema).default({}),
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
  runtime: {
    timeoutMs: 120_000,
  },
  presets: {
    default: undefined,
    named: {},
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
    runtime: {
      timeoutMs: updates.runtime?.timeoutMs ?? base.runtime.timeoutMs,
    },
    presets: {
      default: updates.presets?.default ?? base.presets.default,
      named: {
        ...(base.presets?.named ?? {}),
        ...(updates.presets?.named ?? {}),
      },
    },
    _meta: updates._meta ?? base._meta,
  }
}
