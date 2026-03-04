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
})
