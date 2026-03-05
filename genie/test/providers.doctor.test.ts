import { describe, expect, it, vi } from 'vitest'

import * as base from '../src/providers/base.js'
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
})
