import { describe, expect, it, vi } from 'vitest'

import * as base from '../src/providers/base.js'
import { UsageError } from '../src/errors.js'
import { resolveDoctorTargets } from '../src/providers/doctor-helpers.js'
import { doctorProviders, listProviders } from '../src/providers/doctor.js'

/** Shape emitted by `claude auth status` (values replaced with test data). */
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

describe('providers doctor', () => {
  it('lists all providers', async () => {
    const providers = await listProviders()
    expect(providers.map((item) => item.id)).toEqual(['claude', 'codex', 'cursor-agent', 'gemini'])
  })

  it('returns doctor report entries', async () => {
    const spy = vi.spyOn(base, 'runCommand').mockResolvedValue({
      code: 0,
      stdout: 'ok',
      stderr: '',
    })

    const report = await doctorProviders('codex')
    expect(report.length).toBe(1)
    expect(report[0]?.provider).toBe('codex')
    expect(report[0]?.available).toBe(true)

    spy.mockRestore()
  })

  it('retries timed-out availability check with longer timeout', async () => {
    const spy = vi
      .spyOn(base, 'runCommand')
      .mockResolvedValueOnce({
        code: 124,
        stdout: '',
        stderr: 'Timed out after 3000ms',
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: 'codex-cli 0.110.0',
        stderr: '',
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: 'logged in',
        stderr: '',
      })

    const report = await doctorProviders('codex')
    expect(report[0]?.available).toBe(true)
    expect(report[0]?.authenticated).toBe(true)

    const invocations = spy.mock.calls.map(([invocation]) => invocation)
    expect(invocations[0]?.timeoutMs).toBe(3_000)
    expect(invocations[1]?.timeoutMs).toBe(6_000)

    spy.mockRestore()
  })

  it('returns unavailable when availability probe times out twice', async () => {
    const spy = vi
      .spyOn(base, 'runCommand')
      .mockResolvedValueOnce({
        code: 124,
        stdout: '',
        stderr: 'Timed out after 3000ms',
      })
      .mockResolvedValueOnce({
        code: 124,
        stdout: '',
        stderr: 'Timed out after 6000ms',
      })

    const report = await doctorProviders('codex')
    expect(report[0]?.available).toBe(false)
    expect(report[0]?.authenticated).toBe(false)

    const invocations = spy.mock.calls.map(([invocation]) => invocation)
    expect(invocations[0]?.timeoutMs).toBe(3_000)
    expect(invocations[1]?.timeoutMs).toBe(6_000)

    spy.mockRestore()
  })

  it('returns actionable cursor-agent trust guidance when agent status times out', async () => {
    const spy = vi
      .spyOn(base, 'runCommand')
      .mockResolvedValueOnce({
        code: 0,
        stdout: '2026.02.27-e7d2ef6',
        stderr: '',
      })
      .mockResolvedValueOnce({
        code: 124,
        stdout: '',
        stderr: 'Timed out after 4000ms',
      })

    const report = await doctorProviders('cursor-agent')
    expect(report[0]).toMatchObject({
      provider: 'cursor-agent',
      available: true,
      authenticated: false,
      authDetails: 'Timed out after 4000ms',
      hint: 'The Cursor CLI (`agent`) did not respond to `agent status`. Open Cursor and trust/approve this workspace, or run `agent login` if you are not signed in.',
    })

    const invocations = spy.mock.calls.map(([invocation]) => invocation)
    expect(invocations[0]?.args).toEqual(['--version'])
    expect(invocations[1]?.args).toEqual(['status'])
    expect(invocations[0]?.command).toBe(invocations[1]?.command)

    spy.mockRestore()
  })

  it('returns actionable cursor-agent auth guidance when agent status reports sign-in failure', async () => {
    const spy = vi
      .spyOn(base, 'runCommand')
      .mockResolvedValueOnce({
        code: 0,
        stdout: '2026.02.27-e7d2ef6',
        stderr: '',
      })
      .mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: 'Not authenticated. Please sign in.',
      })

    const report = await doctorProviders('cursor-agent')
    expect(report[0]).toMatchObject({
      provider: 'cursor-agent',
      available: true,
      authenticated: false,
      authDetails: 'Not authenticated. Please sign in.',
      hint: 'The Cursor CLI is not authenticated. Run `agent login` or open Cursor and sign in, then retry.',
    })

    spy.mockRestore()
  })

  it('redacts operator identity from claude auth status by default', async () => {
    const spy = vi
      .spyOn(base, 'runCommand')
      .mockResolvedValueOnce({ code: 0, stdout: '2.1.228 (Claude Code)', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: CLAUDE_AUTH_STATUS, stderr: '' })

    const report = await doctorProviders('claude')
    const serialized = JSON.stringify(report)

    expect(report[0]?.authenticated).toBe(true)
    expect(report[0]?.identityRedacted).toBe(true)
    expect(serialized).not.toContain('operator@example.com')
    expect(serialized).not.toContain('00000000-0000-4000-8000-000000000000')
    expect(report[0]?.authDetails).toContain('"loggedIn": true')

    spy.mockRestore()
  })

  it('shows operator identity only when explicitly requested', async () => {
    const spy = vi
      .spyOn(base, 'runCommand')
      .mockResolvedValueOnce({ code: 0, stdout: '2.1.228 (Claude Code)', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: CLAUDE_AUTH_STATUS, stderr: '' })

    const report = await doctorProviders('claude', { showIdentity: true })

    expect(report[0]?.identityRedacted).toBe(false)
    expect(report[0]?.authDetails).toContain('operator@example.com')

    spy.mockRestore()
  })

  it('reports codex as authenticated via `codex login status`', async () => {
    const spy = vi
      .spyOn(base, 'runCommand')
      .mockResolvedValueOnce({ code: 0, stdout: 'codex-cli 0.147.0', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' })

    const report = await doctorProviders('codex')

    expect(report[0]).toMatchObject({
      provider: 'codex',
      available: true,
      authenticated: true,
      authDetails: 'Logged in using ChatGPT',
    })
    expect(spy.mock.calls[1]?.[0]?.args).toEqual(['login', 'status'])

    spy.mockRestore()
  })

  it('throws a usage error for unknown provider targets', () => {
    expect(() => resolveDoctorTargets('unknown-provider')).toThrow(UsageError)
    expect(() => resolveDoctorTargets('unknown-provider')).toThrow("Unknown provider 'unknown-provider'")
  })
})
