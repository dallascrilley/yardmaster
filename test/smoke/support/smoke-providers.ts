import { piSmokeBackends } from './pi-smoke.js'

export const defaultSmokeProviders = ['claude', 'codex', 'gemini', 'cursor-agent'] as const

export function resolveSmokeProviders(): readonly string[] {
  const raw = process.env.YARDMASTER_SMOKE_PROVIDERS?.trim()
  if (!raw) {
    return defaultSmokeProviders
  }
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return ids.length > 0 ? ids : defaultSmokeProviders
}

export function resolvePiSmokeBackends(providers: readonly string[]): readonly string[] {
  const allowed = new Set(providers)
  return piSmokeBackends.filter((b) => allowed.has(b))
}
