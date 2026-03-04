import { describe, expect, it } from 'vitest'

import { toErrorEnvelope, toResponseEnvelope } from '../src/execution/run-request.js'

describe('output contract', () => {
  it('uses deterministic response envelope keys', () => {
    const envelope = toResponseEnvelope({
      provider: 'codex',
      model: 'gpt-5-codex',
      mode: 'default',
      workspace: '/tmp',
      trust: false,
      response: 'ok',
      raw: { code: 0, stdout: 'ok', stderr: '' },
      fallbackUsed: false,
      timings: {
        totalMs: 10,
        attempts: [
          {
            provider: 'codex',
            stage: 'success',
            durationMs: 10,
            ok: true,
          },
        ],
      },
    })

    expect(Object.keys(envelope)).toEqual(['provider', 'model', 'response', 'fallbackUsed', 'timings', 'error'])
  })

  it('builds stable error envelope for json mode', () => {
    const envelope = toErrorEnvelope({ code: '124', message: 'Timed out' })
    expect(envelope).toEqual({
      provider: null,
      model: null,
      response: '',
      fallbackUsed: false,
      timings: { totalMs: 0, attempts: [] },
      error: {
        code: '124',
        message: 'Timed out',
      },
    })
  })
})
