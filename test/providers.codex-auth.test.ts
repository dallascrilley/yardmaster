import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { codexAuthCheck, parseCodexApiKeyProvider } from '../src/providers/codex-auth.js'
import type { CommandResult, ProviderInvocation } from '../src/types.js'

const originalHome = process.env.HOME
const originalCodexHome = process.env.CODEX_HOME
const PROBE_ENV_VAR = 'YARDMASTER_TEST_CODEX_PROVIDER_KEY'

beforeEach(() => {
  // The config-based auth branch reads $CODEX_HOME/config.toml, so every test
  // gets an empty CODEX_HOME. Without this, a developer's real ~/.codex config
  // would decide the outcome of the tests that expect an auth failure.
  process.env.CODEX_HOME = mkdtempSync(join(tmpdir(), 'yardmaster-codex-home-'))
  delete process.env[PROBE_ENV_VAR]
})

afterEach(() => {
  process.env.HOME = originalHome
  if (originalCodexHome === undefined) {
    delete process.env.CODEX_HOME
  } else {
    process.env.CODEX_HOME = originalCodexHome
  }
  delete process.env[PROBE_ENV_VAR]
})

const CODEX_TOKEN_JSON = JSON.stringify({ tokens: { access_token: 'test-token' } })

/**
 * Point HOME at a scratch dir, optionally containing ~/.codex/auth.json, and
 * clear CODEX_HOME so the default location is what gets exercised.
 */
function useFakeHome(withCodexToken: boolean): void {
  const home = mkdtempSync(join(tmpdir(), 'yardmaster-codex-auth-'))
  if (withCodexToken) {
    mkdirSync(join(home, '.codex'), { recursive: true })
    writeFileSync(join(home, '.codex', 'auth.json'), CODEX_TOKEN_JSON)
  }
  process.env.HOME = home
  delete process.env.CODEX_HOME
}

/** Write a credential into the per-test CODEX_HOME. */
function writeCodexAuthToken(): void {
  writeFileSync(join(process.env.CODEX_HOME!, 'auth.json'), CODEX_TOKEN_JSON)
}

/** Write a config.toml into the per-test CODEX_HOME. */
function writeCodexConfig(toml: string): void {
  writeFileSync(join(process.env.CODEX_HOME!, 'config.toml'), toml)
}

/** The shape the smoke suite uses: codex talking to OpenRouter, no login. */
function apiKeyProviderConfig(envKey = PROBE_ENV_VAR): string {
  return [
    'model = "google/gemini-3-flash-preview"',
    'model_provider = "openrouter"',
    '',
    '[model_providers.openrouter]',
    'name = "OpenRouter"',
    'base_url = "https://openrouter.ai/api/v1"',
    `env_key = "${envKey}"`,
    'wire_api = "responses"',
  ].join('\n')
}

/** Observed verbatim from codex-cli 0.147.0 with an API-key model_provider. */
const NOT_LOGGED_IN: CommandResult = {
  code: 1,
  stdout: 'Not logged in\n',
  stderr: '',
}

/** Observed verbatim from codex-cli 0.147.0, which removed `codex auth`. */
const UNRECOGNIZED_SUBCOMMAND: CommandResult = {
  code: 2,
  stdout: '',
  stderr: "error: unrecognized subcommand 'status'\n\nUsage: codex [OPTIONS] [PROMPT]\n",
}

function recordingRunner(results: CommandResult[]) {
  const calls: ProviderInvocation[] = []
  const runner = async (invocation: ProviderInvocation): Promise<CommandResult> => {
    calls.push(invocation)
    return results[calls.length - 1] ?? { code: 127, stdout: '', stderr: '' }
  }
  return { runner, calls }
}

describe('codexAuthCheck', () => {
  it('uses `codex login status`, the spelling codex-cli 0.147.0 supports', async () => {
    const { runner, calls } = recordingRunner([
      { code: 0, stdout: 'Logged in using ChatGPT\n', stderr: '' },
    ])

    const result = await codexAuthCheck(runner)

    expect(result).toEqual({ ok: true, details: 'Logged in using ChatGPT' })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.command).toBe('codex')
    expect(calls[0]?.args).toEqual(['login', 'status'])
  })

  it('falls back to `codex auth status` on older codex builds', async () => {
    const { runner, calls } = recordingRunner([
      UNRECOGNIZED_SUBCOMMAND,
      { code: 0, stdout: 'Logged in\n', stderr: '' },
    ])

    const result = await codexAuthCheck(runner)

    expect(result).toEqual({ ok: true, details: 'Logged in' })
    expect(calls.map((call) => call.args)).toEqual([
      ['login', 'status'],
      ['auth', 'status'],
    ])
  })

  it('degrades to the credential file when no probe spelling is supported', async () => {
    useFakeHome(true)
    const { runner } = recordingRunner([UNRECOGNIZED_SUBCOMMAND, UNRECOGNIZED_SUBCOMMAND])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(true)
    expect(result.ok && result.details).toContain('no supported codex auth probe')
    expect(result.ok && result.details).toContain('codex login status')
  })

  it('looks for the credential file under CODEX_HOME when it is set', async () => {
    writeCodexAuthToken()
    const { runner } = recordingRunner([UNRECOGNIZED_SUBCOMMAND, UNRECOGNIZED_SUBCOMMAND])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(true)
    expect(result.ok && result.details).toContain('$CODEX_HOME/auth.json')
  })

  it('reports an unsupported-version failure instead of crashing when nothing works', async () => {
    useFakeHome(false)
    const { runner } = recordingRunner([UNRECOGNIZED_SUBCOMMAND, UNRECOGNIZED_SUBCOMMAND])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('no known auth probe')
    expect(result.ok === false && result.hint).toContain('codex login')
  })

  it('surfaces a real auth failure without trying the next spelling', async () => {
    const { runner, calls } = recordingRunner([
      { code: 1, stdout: '', stderr: 'Not logged in. Run codex login.\n' },
    ])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.authFailure).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('marks a timed-out probe as a timeout', async () => {
    const { runner } = recordingRunner([
      { code: 124, stdout: '', stderr: 'Timed out after 4000ms' },
    ])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.timeout).toBe(true)
  })
})

describe('codexAuthCheck with an API-key model_provider', () => {
  it('reports authenticated when the configured env_key is set', async () => {
    writeCodexConfig(apiKeyProviderConfig())
    process.env[PROBE_ENV_VAR] = 'sk-not-a-real-key'
    const { runner, calls } = recordingRunner([NOT_LOGGED_IN])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(true)
    expect(calls.map((call) => call.args)).toEqual([['login', 'status']])
  })

  it('names the provider and the variable, never the value', async () => {
    writeCodexConfig(apiKeyProviderConfig())
    process.env[PROBE_ENV_VAR] = 'sk-not-a-real-key'
    const { runner } = recordingRunner([NOT_LOGGED_IN])

    const result = await codexAuthCheck(runner)

    const details = result.ok ? (result.details ?? '') : ''
    expect(details).toContain('openrouter')
    expect(details).toContain(PROBE_ENV_VAR)
    expect(details).not.toContain('sk-not-a-real-key')
  })

  it('still fails when the config names no env_key for the active provider', async () => {
    writeCodexConfig(
      ['model_provider = "openrouter"', '', '[model_providers.openrouter]', 'name = "OpenRouter"'].join(
        '\n',
      ),
    )
    process.env[PROBE_ENV_VAR] = 'sk-not-a-real-key'
    const { runner } = recordingRunner([NOT_LOGGED_IN])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.authFailure).toBe(true)
  })

  it('still fails when the named environment variable is unset', async () => {
    writeCodexConfig(apiKeyProviderConfig())
    const { runner } = recordingRunner([NOT_LOGGED_IN])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.authFailure).toBe(true)
  })

  it('still fails when the named environment variable is empty', async () => {
    writeCodexConfig(apiKeyProviderConfig())
    process.env[PROBE_ENV_VAR] = '   '
    const { runner } = recordingRunner([NOT_LOGGED_IN])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.authFailure).toBe(true)
  })

  it('ignores an env_key belonging to a provider that is not selected', async () => {
    writeCodexConfig(
      [
        'model_provider = "openrouter"',
        '',
        '[model_providers.groq]',
        `env_key = "${PROBE_ENV_VAR}"`,
      ].join('\n'),
    )
    process.env[PROBE_ENV_VAR] = 'sk-not-a-real-key'
    const { runner } = recordingRunner([NOT_LOGGED_IN])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(false)
  })

  // A broken CLI must stay broken. `codex login status` also exits non-zero for
  // a config it cannot load, and that config still parses here.
  it('does not rescue a probe failure that is not a logged-out report', async () => {
    writeCodexConfig(apiKeyProviderConfig())
    process.env[PROBE_ENV_VAR] = 'sk-not-a-real-key'
    const { runner } = recordingRunner([
      { code: 1, stdout: '', stderr: 'error: failed to parse config.toml: invalid wire_api\n' },
    ])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.details).toContain('failed to parse config.toml')
  })

  it('carries the probe output into the rescue details', async () => {
    writeCodexConfig(apiKeyProviderConfig())
    process.env[PROBE_ENV_VAR] = 'sk-not-a-real-key'
    const { runner } = recordingRunner([NOT_LOGGED_IN])

    const result = await codexAuthCheck(runner)

    expect(result.ok && result.details).toContain('Not logged in')
  })

  it('rescues an unsupported-probe build before the credential-file fallback', async () => {
    writeCodexAuthToken()
    writeCodexConfig(apiKeyProviderConfig())
    process.env[PROBE_ENV_VAR] = 'sk-not-a-real-key'
    const { runner } = recordingRunner([UNRECOGNIZED_SUBCOMMAND, UNRECOGNIZED_SUBCOMMAND])

    const result = await codexAuthCheck(runner)

    expect(result.ok).toBe(true)
    expect(result.ok && result.details).toContain('openrouter')
  })
})

describe('parseCodexApiKeyProvider', () => {
  it('pairs the active model_provider with its env_key', () => {
    expect(parseCodexApiKeyProvider(apiKeyProviderConfig('OPENROUTER_API_KEY'))).toEqual({
      provider: 'openrouter',
      envVar: 'OPENROUTER_API_KEY',
    })
  })

  it('ignores a model_provider assignment that is not top-level', () => {
    const toml = [
      '[profiles.work]',
      'model_provider = "openrouter"',
      '',
      '[model_providers.openrouter]',
      'env_key = "OPENROUTER_API_KEY"',
    ].join('\n')

    expect(parseCodexApiKeyProvider(toml)).toBeUndefined()
  })

  it('strips comments and accepts quoted table keys', () => {
    const toml = [
      'model_provider = "open-router" # trailing comment',
      '[model_providers."open-router"]',
      'env_key = "OPENROUTER_API_KEY" # and here',
    ].join('\n')

    expect(parseCodexApiKeyProvider(toml)).toEqual({
      provider: 'open-router',
      envVar: 'OPENROUTER_API_KEY',
    })
  })

  it('returns undefined for a config with no model_provider', () => {
    expect(parseCodexApiKeyProvider('model = "gpt-5"')).toBeUndefined()
  })

  // The scanner cannot parse `[[x]]`, so it must not leave the previous table
  // in force and attribute that table's env_key to the active provider.
  it('does not carry a section across an array-of-tables header', () => {
    const toml = [
      'model_provider = "openrouter"',
      '',
      '[model_providers.openrouter]',
      'name = "OpenRouter"',
      '',
      '[[mcp_servers]]',
      'env_key = "SOME_OTHER_VAR"',
    ].join('\n')

    expect(parseCodexApiKeyProvider(toml)).toBeUndefined()
  })

  it('does not read assignments out of a multi-line string body', () => {
    const toml = [
      'instructions = """',
      'model_provider = "evil"',
      '[model_providers.evil]',
      'env_key = "EVIL_VAR"',
      '"""',
      '',
      'model = "gpt-5"',
    ].join('\n')

    expect(parseCodexApiKeyProvider(toml)).toBeUndefined()
  })

  it('still reads the config that follows a multi-line string', () => {
    const toml = [
      'instructions = """',
      'be concise',
      '"""',
      'model_provider = "openrouter"',
      '',
      '[model_providers.openrouter]',
      'env_key = "OPENROUTER_API_KEY"',
    ].join('\n')

    expect(parseCodexApiKeyProvider(toml)).toEqual({
      provider: 'openrouter',
      envVar: 'OPENROUTER_API_KEY',
    })
  })

  it('ignores an env_key in a nested sub-table of the active provider', () => {
    const toml = [
      'model_provider = "openrouter"',
      '',
      '[model_providers.openrouter.http_headers]',
      'env_key = "NOT_THE_PROVIDER_KEY"',
    ].join('\n')

    expect(parseCodexApiKeyProvider(toml)).toBeUndefined()
  })
})
