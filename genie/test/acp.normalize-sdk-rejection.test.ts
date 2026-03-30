import { describe, expect, it } from 'vitest'
import { RequestError } from '@agentclientprotocol/sdk'
import { AcpProtocolError } from '../src/errors.js'
import { formatAcpFailureForUi, normalizeAcpSdkRejection } from '../src/acp/normalize-sdk-rejection.js'

describe('normalizeAcpSdkRejection', () => {
  it('wraps raw JSON-RPC error objects from the SDK', () => {
    const err = normalizeAcpSdkRejection(
      { code: -32603, message: 'Internal error', data: { foo: 1 } },
      'gemini',
    )
    expect(err).toBeInstanceOf(AcpProtocolError)
    expect((err as AcpProtocolError).code).toBe(-32603)
    expect(err.message).toContain('Internal error')
    expect(err.message).toContain('foo')
  })

  it('passes through RequestError', () => {
    const err = normalizeAcpSdkRejection(new RequestError(-32000, 'auth'), 'gemini')
    expect(err).toBeInstanceOf(AcpProtocolError)
    expect((err as AcpProtocolError).code).toBe(-32000)
  })

  it('formatAcpFailureForUi stringifies JSON-RPC objects', () => {
    expect(formatAcpFailureForUi({ code: 1, message: 'x', data: [1] })).toBe('x ([1])')
  })
})
