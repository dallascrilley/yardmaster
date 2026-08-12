import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { type ProviderCheckResult, type CommandRunner } from '../types.js'

function resolveHomeDirectory(): string {
  const envHome = process.env.HOME?.trim()
  return envHome && envHome.length > 0 ? envHome : homedir()
}

export function hasCodexAuthToken(): boolean {
  const authPath = join(resolveHomeDirectory(), '.codex', 'auth.json')
  if (!existsSync(authPath)) {
    return false
  }

  try {
    const raw = readFileSync(authPath, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const candidateKeys = [
      'api_key',
      'apiKey',
      'token',
      'access_token',
      'accessToken',
      'OPENAI_API_KEY',
    ]

    const topLevelToken = candidateKeys.some((key) => {
      const value = parsed[key]
      return typeof value === 'string' && value.trim().length > 0
    })

    if (topLevelToken) {
      return true
    }

    const tokens = parsed.tokens
    if (!tokens || typeof tokens !== 'object') {
      return false
    }

    const allowedTokenKeys = new Set(['api_key', 'apiKey', 'token', 'access_token', 'accessToken', 'key'])

    return Object.entries(tokens as Record<string, unknown>).some(([key, value]) => {
      if (typeof value === 'string') {
        return allowedTokenKeys.has(key) && value.trim().length > 0
      }

      if (!value || typeof value !== 'object') {
        return false
      }

      return Object.entries(value as Record<string, unknown>).some(
        ([key, innerValue]) =>
          allowedTokenKeys.has(key) &&
          typeof innerValue === 'string' &&
          innerValue.trim().length > 0,
      )
    })
  } catch {
    return false
  }
}

/**
 * Auth probes for the Codex CLI, newest spelling first.
 *
 * `codex auth status` was removed from the Codex CLI; 0.147.0 answers it with
 * `error: unrecognized subcommand 'status'` and exit 2. `codex login status`
 * is the current spelling. Both are tried so one binary version does not
 * decide the whole check, and a CLI that supports neither degrades to an
 * explicit unsupported-version result instead of a bogus auth failure.
 */
const CODEX_AUTH_PROBES: readonly (readonly string[])[] = [
  ['login', 'status'],
  ['auth', 'status'],
]

const UNSUPPORTED_SUBCOMMAND_SIGNALS = [
  'unrecognized subcommand',
  'unknown subcommand',
  'unrecognized command',
  'unknown command',
  'unexpected argument',
  'invalid subcommand',
  'usage:',
]

function isUnsupportedSubcommand(stdout: string, stderr: string): boolean {
  const output = `${stderr}\n${stdout}`.toLowerCase()
  return UNSUPPORTED_SUBCOMMAND_SIGNALS.some((signal) => output.includes(signal))
}

export async function codexAuthCheck(runner: CommandRunner): Promise<ProviderCheckResult> {
  const attempted: string[] = []

  for (const args of CODEX_AUTH_PROBES) {
    attempted.push(`codex ${args.join(' ')}`)

    const result = await runner({
      command: 'codex',
      args: [...args],
      timeoutMs: 4_000,
    })

    if (result.code === 0) {
      return { ok: true, details: (result.stdout || result.stderr).trim() || undefined }
    }

    if (result.code === 124) {
      return {
        ok: false,
        reason: `${attempted[attempted.length - 1]} timed out`,
        details: result.stderr || result.stdout || undefined,
        hint: 'The Codex CLI did not respond to its auth probe. Retry, or run `codex login` to confirm the CLI is healthy.',
        authFailure: true,
        timeout: true,
        code: result.code,
      }
    }

    if (isUnsupportedSubcommand(result.stdout, result.stderr)) {
      continue
    }

    return {
      ok: false,
      reason: 'codex authentication check failed',
      details: result.stderr || result.stdout || undefined,
      hint: result.stderr || result.stdout || 'Run `codex login` and retry.',
      authFailure: true,
      code: result.code,
    }
  }

  // Every probe spelling was rejected by this Codex CLI build. Fall back to the
  // credential file so a working install is not reported as unauthenticated.
  if (hasCodexAuthToken()) {
    return {
      ok: true,
      details: `no supported codex auth probe (tried ${attempted.join(', ')}); credentials found in ~/.codex/auth.json`,
    }
  }

  return {
    ok: false,
    reason: `this codex CLI supports no known auth probe (tried ${attempted.join(', ')})`,
    hint: 'Run `codex login`, or upgrade the Codex CLI so `codex login status` is available, and retry.',
    authFailure: true,
  }
}
