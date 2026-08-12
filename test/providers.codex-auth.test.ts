import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { codexAuthCheck } from '../src/providers/codex-auth.js'
import type { CommandResult, ProviderInvocation } from '../src/types.js'

const originalHome = process.env.HOME

afterEach(() => {
  process.env.HOME = originalHome
})

/** Point HOME at a scratch dir, optionally containing ~/.codex/auth.json. */
function useFakeHome(withCodexToken: boolean): void {
  const home = mkdtempSync(join(tmpdir(), 'yardmaster-codex-auth-'))
  if (withCodexToken) {
    mkdirSync(join(home, '.codex'), { recursive: true })
    writeFileSync(
      join(home, '.codex', 'auth.json'),
      JSON.stringify({ tokens: { access_token: 'test-token' } }),
    )
  }
  process.env.HOME = home
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
