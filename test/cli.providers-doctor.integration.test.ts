import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * Real `claude auth status` output, with the account values swapped for test
 * data. This is the payload that used to reach `providers doctor --json`
 * verbatim.
 */
const CLAUDE_AUTH_STATUS = JSON.stringify(
  {
    loggedIn: true,
    authMethod: 'claude.ai',
    apiProvider: 'firstParty',
    email: 'operator@example.com',
    orgId: '00000000-0000-4000-8000-000000000000',
    orgName: "operator@example.com's Organization",
    subscriptionType: 'max',
  },
  null,
  2,
)

let fakeBinDir: string

/** A stub `claude` that answers --version and auth status the way the real CLI does. */
beforeAll(() => {
  fakeBinDir = mkdtempSync(join(tmpdir(), 'yardmaster-fake-bin-'))
  const stub = join(fakeBinDir, 'claude')
  writeFileSync(
    stub,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "2.1.228 (Claude Code)"; exit 0; fi',
      'if [ "$1" = "auth" ] && [ "$2" = "status" ]; then',
      `  cat <<'JSON'`,
      CLAUDE_AUTH_STATUS,
      'JSON',
      '  exit 0',
      'fi',
      'exit 1',
      '',
    ].join('\n'),
  )
  chmodSync(stub, 0o755)
})

function runDoctor(args: string[]) {
  return spawnSync('bun', ['src/bin/yardmaster.ts', 'providers', 'doctor', '--provider', 'claude', ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${fakeBinDir}:${process.env.PATH ?? ''}` },
  })
}

describe('providers doctor identity handling end to end', () => {
  it('never prints the operator account by default', () => {
    const result = runDoctor(['--json'])

    expect(result.status).toBe(0)
    // The whole stream, not just the parsed field, so a leak anywhere fails.
    expect(result.stdout).not.toContain('operator@example.com')
    expect(result.stdout).not.toContain('00000000-0000-4000-8000-000000000000')
    expect(result.stdout).not.toContain('Organization')
    expect(result.stderr).not.toContain('operator@example.com')

    const parsed = JSON.parse(result.stdout) as {
      providers: Array<{ authenticated: boolean; identityRedacted: boolean; authDetails: string }>
    }
    const claude = parsed.providers[0]
    expect(claude?.authenticated).toBe(true)
    expect(claude?.identityRedacted).toBe(true)
    // Non-identity fields survive so the report is still worth reading.
    expect(claude?.authDetails).toContain('"loggedIn": true')
    expect(claude?.authDetails).toContain('"subscriptionType": "max"')
  })

  it('prints the operator account when --show-identity is passed', () => {
    const result = runDoctor(['--show-identity', '--json'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('operator@example.com')

    const parsed = JSON.parse(result.stdout) as {
      providers: Array<{ identityRedacted: boolean }>
    }
    expect(parsed.providers[0]?.identityRedacted).toBe(false)
  })

  it('keeps the human-readable report free of the operator account', () => {
    const result = runDoctor([])

    expect(result.status).toBe(0)
    expect(`${result.stdout}${result.stderr}`).not.toContain('operator@example.com')
    expect(result.stdout).toContain('claude | available | authenticated')
  })
})
