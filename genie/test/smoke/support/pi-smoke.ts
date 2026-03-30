/** Canonical CLIs exercised through the `pi` provider alias in smoke tests. */
export const piSmokeBackends = ['claude', 'codex', 'gemini', 'cursor-agent'] as const

export type PiSmokeBackend = (typeof piSmokeBackends)[number]
