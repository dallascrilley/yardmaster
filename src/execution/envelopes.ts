import { type YardmasterResponseEnvelope, type YardmasterRunResult } from '../types.js'

export function toResponseEnvelope(result: YardmasterRunResult): YardmasterResponseEnvelope {
  return {
    provider: result.provider,
    model: result.model ?? null,
    response: result.response,
    fallbackUsed: result.fallbackUsed,
    timings: result.timings,
    error: null,
  }
}

export function toErrorEnvelope(error: { code: string; message: string }, timings?: YardmasterRunResult['timings']): YardmasterResponseEnvelope {
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
