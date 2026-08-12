import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { resolveYardmasterPackageRoot } from './support/yardmaster-root.js'
import { resolveSmokeProviders } from './support/smoke-providers.js'

type DoctorEntry = {
  provider: string
  available: boolean
  authenticated: boolean
  availabilityDetails?: string
  authDetails?: string
}

type DoctorEnvelope = {
  kind?: string
  ok?: boolean
  exitCode?: number
  providers?: DoctorEntry[]
}

/**
 * The secret each provider needs to reach a model from a fresh CI runner.
 *
 * Only the providers actually selected by `YARDMASTER_SMOKE_PROVIDERS` are
 * checked, so a codex-only run is not blocked by a missing Gemini key and vice
 * versa. `codex` is listed against `OPENROUTER_API_KEY` because CI drives it
 * through an OpenRouter `model_provider` in `$CODEX_HOME/config.toml` rather
 * than an interactive ChatGPT login — see `.github/workflows/smoke.yml`.
 * Providers absent from this map (claude, cursor-agent) have no secret-based
 * auth path; selecting them in CI fails the doctor gate below instead.
 */
const requiredSecretEnvVars: Record<string, string> = {
  gemini: 'GEMINI_API_KEY',
  codex: 'OPENROUTER_API_KEY',
}

export default function globalSetup(): void {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return
  }

  // Required rather than defaulted: `resolveSmokeProviders()` falls back to all
  // four providers, and claude and cursor-agent can never authenticate on a
  // runner, so an unset variable would fail the gate below with a confusing
  // message instead of naming the actual mistake.
  if (!process.env.YARDMASTER_SMOKE_PROVIDERS?.trim()) {
    throw new Error(
      'smoke CI: YARDMASTER_SMOKE_PROVIDERS must name the providers this job can authenticate ' +
        '(for example YARDMASTER_SMOKE_PROVIDERS=codex, which `bun run test:smoke:preflight` sets)',
    )
  }

  const providers = resolveSmokeProviders()

  for (const provider of providers) {
    const envVar = requiredSecretEnvVars[provider]
    if (envVar && !process.env[envVar]?.trim()) {
      throw new Error(
        `smoke CI: ${envVar} must be set so ${provider} can run in Actions (selected providers: ${providers.join(', ')})`,
      )
    }
  }

  const projectRoot = resolveYardmasterPackageRoot()
  const bunResult = spawnSync('which', ['bun'], { encoding: 'utf8' })
  const bunBinary = bunResult.status === 0 ? bunResult.stdout.trim() : 'bun'
  const cli = join(projectRoot, 'src', 'bin', 'yardmaster.ts')

  const result = spawnSync(bunBinary, [cli, 'providers', 'doctor', '--json'], {
    encoding: 'utf8',
    timeout: 120_000,
    cwd: projectRoot,
  })

  const raw = typeof result.stdout === 'string' ? result.stdout : ''
  if (result.status !== 0) {
    throw new Error(
      `smoke CI: providers doctor exited ${String(result.status)}: ${String(result.stderr ?? '')} ${raw.slice(0, 500)}`,
    )
  }

  let envelope: DoctorEnvelope
  try {
    envelope = JSON.parse(raw) as DoctorEnvelope
  } catch {
    throw new Error(`smoke CI: failed to parse providers doctor JSON: ${raw.slice(0, 500)}`)
  }

  if (envelope.kind === 'error' || envelope.ok !== true || (envelope.exitCode ?? 0) !== 0) {
    throw new Error(
      `smoke CI: providers doctor JSON indicates failure (kind=${String(envelope.kind)} ok=${String(envelope.ok)} exitCode=${String(envelope.exitCode)}): ${raw.slice(0, 500)}`,
    )
  }

  const entries = envelope.providers
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('smoke CI: providers doctor returned no provider entries')
  }

  // Every selected provider must be usable. Without this, `provider-check.ts`
  // would quietly skip a broken provider and the suite would pass vacuously.
  for (const provider of providers) {
    const entry = entries.find((candidate) => candidate.provider === provider)
    if (!entry) {
      throw new Error(
        `smoke CI: providers doctor has no entry for selected provider "${provider}"`,
      )
    }
    if (!entry.available || !entry.authenticated) {
      throw new Error(
        `smoke CI: ${provider} must be available and authenticated in doctor output ` +
          `(available=${String(entry.available)} authenticated=${String(entry.authenticated)}` +
          `${entry.availabilityDetails ? ` availability=${entry.availabilityDetails}` : ''}` +
          `${entry.authDetails ? ` auth=${entry.authDetails}` : ''})`,
      )
    }
  }
}
