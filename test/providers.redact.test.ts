import { describe, expect, it } from 'vitest'

import { redactIdentity } from '../src/providers/redact.js'

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

describe('redactIdentity', () => {
  it('removes email, org id, and org name from claude auth status JSON', () => {
    const redacted = redactIdentity(CLAUDE_AUTH_STATUS)
    expect(redacted).toBeDefined()
    expect(redacted).not.toContain('operator@example.com')
    expect(redacted).not.toContain('00000000-0000-4000-8000-000000000000')
    expect(redacted).not.toContain('Organization')
  })

  it('keeps non-identity fields so the payload stays useful', () => {
    const parsed = JSON.parse(redactIdentity(CLAUDE_AUTH_STATUS) as string) as Record<string, unknown>
    expect(parsed.loggedIn).toBe(true)
    expect(parsed.authMethod).toBe('claude.ai')
    expect(parsed.apiProvider).toBe('firstParty')
    expect(parsed.subscriptionType).toBe('max')
    expect(parsed.email).toBe('[redacted]')
    expect(parsed.orgId).toBe('[redacted]')
    expect(parsed.orgName).toBe('[redacted]')
  })

  it('redacts identity nested under other keys without nuking the container', () => {
    const parsed = JSON.parse(
      redactIdentity(
        JSON.stringify({ account: { email: 'a@b.com', name: 'Acme', plan: 'pro', seats: 5 }, ok: true }),
      ) as string,
    ) as { account: Record<string, unknown>; ok: boolean }
    expect(parsed.account.email).toBe('[redacted]')
    expect(parsed.account.name).toBe('[redacted]')
    // Diagnostic fields are the reason to paste a doctor report at all.
    expect(parsed.account.plan).toBe('pro')
    expect(parsed.account.seats).toBe(5)
    expect(parsed.ok).toBe(true)
  })

  it('redacts JSON wrapped in a version notice and a trailing hint', () => {
    const redacted = redactIdentity(
      `Update available!\n${CLAUDE_AUTH_STATUS}\nRun \`claude login\` to switch accounts.`,
    ) as string
    expect(redacted).not.toContain('operator@example.com')
    expect(redacted).not.toContain('Organization')
    expect(redacted).toContain('Update available!')
    expect(redacted).toContain('Run `claude login` to switch accounts.')
  })

  it('redacts every object in NDJSON output', () => {
    const redacted = redactIdentity(
      '{"email":"a@b.com","ok":true}\n{"orgName":"Acme Robotics Inc","ok":false}',
    ) as string
    expect(redacted).not.toContain('a@b.com')
    expect(redacted).not.toContain('Acme Robotics Inc')
    expect(redacted).toContain('"ok": true')
    expect(redacted).toContain('"ok": false')
  })

  it('redacts labelled identity lines in human-readable output', () => {
    const redacted = redactIdentity(
      ['Logged in.', 'Org Name: Acme Robotics Inc', 'Account ID: acct_1P2q3R4s5T', 'Plan: pro'].join('\n'),
    ) as string
    expect(redacted).not.toContain('Acme Robotics Inc')
    expect(redacted).not.toContain('acct_1P2q3R4s5T')
    expect(redacted).toContain('Org Name: [redacted]')
    // Non-identity labels survive.
    expect(redacted).toContain('Plan: pro')
  })

  it('redacts emails and uuids in plain-text provider output', () => {
    const redacted = redactIdentity(
      'Logged in as operator@example.com (org 00000000-0000-4000-8000-000000000000)',
    )
    expect(redacted).toBe('Logged in as [redacted] (org [redacted])')
  })

  it('leaves identity-free output untouched', () => {
    expect(redactIdentity('Logged in using ChatGPT')).toBe('Logged in using ChatGPT')
    expect(redactIdentity('codex-cli 0.147.0')).toBe('codex-cli 0.147.0')
  })

  it('passes undefined through', () => {
    expect(redactIdentity(undefined)).toBeUndefined()
  })

  it('stays linear on long output with no address in it', () => {
    // An unbounded local-part quantifier rescans the whole run from every
    // offset, so this input used to take ~26s. Provider CLIs can be chatty;
    // a doctor probe must not stall on one.
    const haystack = JSON.stringify({ log: 'b'.repeat(100_000) })
    const startedAt = Date.now()
    const redacted = redactIdentity(haystack)
    expect(Date.now() - startedAt).toBeLessThan(1_000)
    expect(redacted).toContain('bbb')
  })

  it('still redacts an address buried in long output', () => {
    const haystack = `${'x'.repeat(50_000)} contact operator@example.com now`
    expect(redactIdentity(haystack)).toContain('contact [redacted] now')
  })
})
