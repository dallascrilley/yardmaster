import { describe, expect, it } from 'vitest'

import { toCliJsonErrorEnvelope, toCliJsonSuccessEnvelope } from '../src/cli/json.js'
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

  it('adds shared cli json metadata to success payloads', () => {
    expect(toCliJsonSuccessEnvelope('providers_list', { providers: [{ id: 'codex' }] })).toEqual({
      kind: 'providers_list',
      version: 1,
      ok: true,
      providers: [{ id: 'codex' }],
      exitCode: 0,
      error: null,
    })
  })

  it('builds stable design success envelopes for json mode', () => {
    expect(toCliJsonSuccessEnvelope('design_result', { provider: 'claude', response: 'ok' })).toEqual({
      kind: 'design_result',
      version: 1,
      ok: true,
      provider: 'claude',
      response: 'ok',
      exitCode: 0,
      error: null,
    })
  })

  it('builds shared cli json error envelopes', () => {
    expect(toCliJsonErrorEnvelope(2, { code: '2', message: 'bad args' })).toEqual({
      kind: 'error',
      version: 1,
      ok: false,
      exitCode: 2,
      error: {
        code: '2',
        message: 'bad args',
      },
    })
  })
})
