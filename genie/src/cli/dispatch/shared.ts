import { readFileSync } from 'node:fs'

import { UsageError } from '../../errors.js'
import { type ProviderPreset } from '../../types.js'
import { normalizeTextInput, readTextInput } from '../input.js'
import type { RunOptions } from '../types.js'

export function readPackageVersion(): string {
  try {
    const pkgPath = new URL('../../../package.json', import.meta.url)
    const raw = readFileSync(pkgPath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function mergeRunOptionsWithPreset(options: RunOptions, preset?: ProviderPreset): RunOptions {
  if (!preset) {
    return options
  }

  return {
    ...options,
    provider: options.provider ?? preset.provider,
    model: options.model ?? preset.model,
    mode: options.mode ?? preset.mode,
    trust: options.trust ?? preset.trust,
    yolo: options.yolo ?? preset.yolo,
    outputFormat: options.outputFormat ?? preset.outputFormat,
    includeDirectories: options.includeDirectories ?? preset.includeDirectories,
    headless: options.headless ?? preset.headless,
    extensions: options.extensions ?? preset.extensions,
    mcp: options.mcp ?? preset.mcp,
  }
}

export function resolveRunPrompt(prompt: string | undefined, promptFile: string | undefined): string {
  if (prompt !== undefined) {
    if (prompt.trim().length > 0 || !promptFile) {
      return normalizeTextInput(prompt, 'Prompt is required')
    }
  }

  if (!promptFile) {
    throw new UsageError('Prompt is required')
  }

  return normalizeTextInput(readTextInput(promptFile), 'Prompt is required')
}
