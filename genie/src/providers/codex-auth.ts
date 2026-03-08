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

export async function codexAuthCheck(runner: CommandRunner): Promise<ProviderCheckResult> {
  const result = await runner({
    command: 'codex',
    args: ['auth', 'status'],
    timeoutMs: 4_000,
  })

  if (result.code === 0) {
    return { ok: true, details: (result.stdout || result.stderr).trim() || undefined }
  }

  const output = `${result.stderr}\n${result.stdout}`.toLowerCase()
  if (output.includes('unknown') || output.includes('unrecognized') || output.includes('usage')) {
    if (hasCodexAuthToken()) {
      return {
        ok: true,
        details: 'codex auth status unsupported; token found in ~/.codex/auth.json',
      }
    }

    return {
      ok: false,
      reason: 'codex authentication not configured',
      hint: 'Run codex login or add a token to ~/.codex/auth.json and retry.',
      authFailure: true,
    }
  }

  return {
    ok: false,
    reason: 'codex authentication check failed',
    hint: result.stderr || result.stdout || 'Run codex login and retry.',
    authFailure: true,
    timeout: result.code === 124,
    code: result.code,
  }
}
