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

  it('redacts identity nested under other keys', () => {
    const parsed = JSON.parse(
      redactIdentity(JSON.stringify({ account: { email: 'a@b.com', plan: 'pro' }, ok: true })) as string,
    ) as { account: Record<string, unknown>; ok: boolean }
    expect(parsed.account.email).toBe('[redacted]')
    expect(parsed.account.plan).toBe('[redacted]')
    expect(parsed.ok).toBe(true)
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
})
