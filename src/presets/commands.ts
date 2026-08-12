import { UsageError } from '../errors.js'
import { isConfigProviderId } from '../execution/provider-aliases.js'
import { type ConfigProviderId, type ProviderPreset } from '../types.js'
import { updateConfig, loadConfig } from '../config/store.js'

export type PresetSetInput = {
  provider?: ConfigProviderId
  model?: string
  mode?: string
  trust?: boolean
  yolo?: boolean
  headless?: boolean
  includeDirectories?: string[]
  outputFormat?: 'text' | 'json' | 'stream-json'
  extensions?: string[]
  mcp?: string[]
}

function normalizeList(values?: string[]): string[] | undefined {
  if (!values) return undefined
  return values
    .map((value) => value.trim())
    .filter(Boolean)
}

function validateProvider(provider?: string): ConfigProviderId | undefined {
  if (!provider) return undefined
  const normalized = provider.trim().toLowerCase()
  if (!isConfigProviderId(normalized)) {
    throw new UsageError(`Invalid provider '${provider}'`)
  }
  return normalized
}

function validatePresetName(name: string): string {
  const value = name.trim()
  if (!value) throw new UsageError('Preset name cannot be empty')
  return value
}

function normalizePreset(input: PresetSetInput): ProviderPreset {
  return {
    ...(input.provider ? { provider: validateProvider(input.provider) } : {}),
    ...(input.model ? { model: input.model.trim() } : {}),
    ...(input.mode ? { mode: input.mode.trim() } : {}),
    ...(typeof input.trust === 'boolean' ? { trust: input.trust } : {}),
    ...(typeof input.yolo === 'boolean' ? { yolo: input.yolo } : {}),
    ...(typeof input.headless === 'boolean' ? { headless: input.headless } : {}),
    ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
    ...(input.includeDirectories ? { includeDirectories: normalizeList(input.includeDirectories) } : {}),
    ...(input.extensions ? { extensions: normalizeList(input.extensions) } : {}),
    ...(input.mcp ? { mcp: normalizeList(input.mcp) } : {}),
  }
}

function applySetPreset(
  current: Awaited<ReturnType<typeof loadConfig>>,
  name: string,
  input: PresetSetInput,
  options?: { setDefault?: boolean },
): { config: Awaited<ReturnType<typeof loadConfig>>; replaced: boolean } {
  const key = validatePresetName(name)
  const normalized = normalizePreset(input)
  const currentPreset = current.presets.named[key] ?? {}

  return {
    replaced: Boolean(current.presets.named[key]),
    config: {
      ...current,
      presets: {
        default: options?.setDefault ? key : current.presets.default,
        named: {
          ...current.presets.named,
          [key]: {
            ...currentPreset,
            ...normalized,
          },
        },
      },
    },
  }
}

function applyDeletePreset(current: Awaited<ReturnType<typeof loadConfig>>, name: string): Awaited<ReturnType<typeof loadConfig>> {
  const key = validatePresetName(name)
  if (!current.presets.named[key]) {
    throw new UsageError(`Unknown preset '${key}'`)
  }
  const named = { ...current.presets.named }
  delete named[key]
  return {
    ...current,
    presets: {
      default: current.presets.default === key ? undefined : current.presets.default,
      named,
    },
  }
}

function applyUsePreset(current: Awaited<ReturnType<typeof loadConfig>>, name: string): Awaited<ReturnType<typeof loadConfig>> {
  const key = validatePresetName(name)
  if (!current.presets.named[key]) {
    throw new UsageError(`Unknown preset '${key}'`)
  }
  return {
    ...current,
    presets: {
      ...current.presets,
      default: key,
    },
  }
}

export async function listPresets(): Promise<{ default?: string; named: Record<string, ProviderPreset> }> {
  const config = await loadConfig()
  return {
    default: config.presets.default,
    named: config.presets.named,
  }
}

export async function getPreset(name: string): Promise<ProviderPreset> {
  const key = validatePresetName(name)
  const config = await loadConfig()
  const preset = config.presets.named[key]
  if (!preset) {
    throw new UsageError(`Unknown preset '${key}'`)
  }
  return preset
}

export async function setPreset(
  name: string,
  input: PresetSetInput,
  options?: { setDefault?: boolean },
): Promise<{ name: string; preset: ProviderPreset; default?: string; replaced: boolean }> {
  const key = validatePresetName(name)
  let replaced = false
  const updated = await updateConfig((current) => {
    const applied = applySetPreset(current, key, input, options)
    replaced = applied.replaced
    return applied.config
  })

  return {
    name: key,
    preset: updated.presets.named[key],
    default: updated.presets.default,
    replaced,
  }
}

export async function previewSetPreset(
  name: string,
  input: PresetSetInput,
  options?: { setDefault?: boolean },
): Promise<{ name: string; preset: ProviderPreset; default?: string; replaced: boolean }> {
  const key = validatePresetName(name)
  const current = await loadConfig()
  const preview = applySetPreset(current, key, input, options)
  return {
    name: key,
    preset: preview.config.presets.named[key],
    default: preview.config.presets.default,
    replaced: preview.replaced,
  }
}

export async function deletePreset(name: string): Promise<{ deleted: string; default?: string }> {
  const key = validatePresetName(name)
  const updated = await updateConfig((current) => {
    return applyDeletePreset(current, key)
  })

  return {
    deleted: key,
    default: updated.presets.default,
  }
}

export async function previewDeletePreset(name: string): Promise<{ deleted: string; default?: string }> {
  const key = validatePresetName(name)
  const current = await loadConfig()
  const updated = applyDeletePreset(current, key)
  return {
    deleted: key,
    default: updated.presets.default,
  }
}

export async function usePreset(name: string): Promise<{ default: string }> {
  const key = validatePresetName(name)
  const updated = await updateConfig((current) => {
    return applyUsePreset(current, key)
  })

  return {
    default: updated.presets.default as string,
  }
}

export async function previewUsePreset(name: string): Promise<{ default: string }> {
  const updated = applyUsePreset(await loadConfig(), name)
  return {
    default: updated.presets.default as string,
  }
}
