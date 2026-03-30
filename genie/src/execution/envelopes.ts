import { type GenieResponseEnvelope, type GenieRunResult } from '../types.js'
import { defaultConfig } from '../config/schema.js'
import { normalizeRequest, type NormalizedPromptRequest } from './normalize.js'
import type { RunRequestInput } from './run-request.js'

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
  if (value === null || typeof value !== 'object') {
    return false
  }
  try {
    normalizeRequest(value as RunRequestInput, defaultConfig)
    return true
  } catch {
    return false
  }
}
