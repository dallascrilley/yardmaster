import { defineConfig } from 'vitest/config'

/**
 * Forwarded to test workers so a worker sees the same provider wiring the main
 * process was launched with: which providers to exercise, the provider secrets,
 * and the codex-specific overrides (CODEX_HOME selects the OpenRouter
 * `model_provider` config, YARDMASTER_CODEX_ACP_BIN points at a codex-acp that
 * is not on PATH).
 *
 * Unset variables are omitted rather than forwarded as `''`. A worker passes its
 * environment down to the provider CLIs it spawns, and an exported-but-empty
 * `CODEX_HOME` is not the same thing to those CLIs as an absent one.
 */
function passthroughEnv(): Record<string, string> {
  const names = [
    'GITHUB_ACTIONS',
    'YARDMASTER_SMOKE_PROVIDERS',
    'GEMINI_API_KEY',
    'OPENROUTER_API_KEY',
    'CODEX_HOME',
    'YARDMASTER_CODEX_ACP_BIN',
  ]

  const env: Record<string, string> = {}
  for (const name of names) {
    const value = process.env[name]
    if (typeof value === 'string' && value.length > 0) {
      env[name] = value
    }
  }
  return env
}

export default defineConfig({
  test: {
    globalSetup: ['./test/smoke/global-setup.ts'],
    include: ['test/smoke/**/*.test.ts'],
    environment: 'node',
    env: passthroughEnv(),
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
    retry: 1,
  },
})
