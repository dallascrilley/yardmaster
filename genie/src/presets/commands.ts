import { UsageError } from '../errors.js'
import { providerIds, type ProviderId, type ProviderPreset } from '../types.js'
import { updateConfig, loadConfig } from '../config/store.js'

export type PresetSetInput = {
  provider?: ProviderId
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

function validateProvider(provider?: string): ProviderId | undefined {
  if (!provider) return undefined
  if (!providerIds.includes(provider as ProviderId)) {
    throw new UsageError(`Invalid provider '${provider}'. Expected one of: ${providerIds.join(', ')}`)
  }
  return provider as ProviderId
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
): Promise<{ name: string; preset: ProviderPreset; default?: string }> {
  const key = validatePresetName(name)
  const normalized = normalizePreset(input)
  const updated = await updateConfig((current) => {
    const currentPreset = current.presets.named[key] ?? {}
    return {
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
    }
  })

  return {
    name: key,
    preset: updated.presets.named[key],
    default: updated.presets.default,
  }
}

export async function deletePreset(name: string): Promise<{ deleted: string; default?: string }> {
  const key = validatePresetName(name)
  const updated = await updateConfig((current) => {
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
  })

  return {
    deleted: key,
    default: updated.presets.default,
  }
}

export async function usePreset(name: string): Promise<{ default: string }> {
  const key = validatePresetName(name)
  const updated = await updateConfig((current) => {
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
  })

  return {
    default: updated.presets.default as string,
  }
}
