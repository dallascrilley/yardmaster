import { describe, expect, it, vi } from 'vitest'

import * as base from '../src/providers/base.js'
import { UsageError } from '../src/errors.js'
import { resolveDoctorTargets } from '../src/providers/doctor-helpers.js'
import { doctorProviders, listProviders } from '../src/providers/doctor.js'

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

  it('returns actionable cursor-agent trust guidance when auth status times out', async () => {
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
      hint: 'cursor-agent did not respond to `auth status`. Open Cursor and trust/approve this workspace for agent access before retrying.',
    })

    spy.mockRestore()
  })

  it('returns actionable cursor-agent auth guidance when auth status reports sign-in failure', async () => {
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
      hint: 'cursor-agent is not authenticated. Open Cursor, sign in to your account, then retry.',
    })

    spy.mockRestore()
  })

  it('throws a usage error for unknown provider targets', () => {
    expect(() => resolveDoctorTargets('unknown-provider')).toThrow(UsageError)
    expect(() => resolveDoctorTargets('unknown-provider')).toThrow("Unknown provider 'unknown-provider'")
  })
})
