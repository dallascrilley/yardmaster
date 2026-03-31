import { RequestError } from '@agentclientprotocol/sdk'
import type { ProviderId } from '../types.js'
import { AcpProtocolError, RuntimeProviderError } from '../errors.js'

function isJsonRpcErrorObject(err: unknown): err is { code: number; message: string; data?: unknown } {
  if (typeof err !== 'object' || err === null) {
    return false
  }
  const o = err as Record<string, unknown>
  return typeof o.code === 'number' && typeof o.message === 'string'
}

function serializeUnknown(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (isJsonRpcErrorObject(err)) {
    const tail = err.data !== undefined ? ` ${JSON.stringify(err.data)}` : ''
    return `${err.message}${tail}`
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/**
 * The SDK's JSON-RPC layer rejects with raw `{ code, message, data? }` objects in some paths,
 * not `RequestError` instances. Normalize so callers get proper Error subclasses and messages.
 */
export function normalizeAcpSdkRejection(err: unknown, providerId: ProviderId): Error {
  if (err instanceof RequestError) {
    return new AcpProtocolError(err.code, err.message, providerId)
  }
  if (isJsonRpcErrorObject(err)) {
    const tail = err.data !== undefined ? ` (${JSON.stringify(err.data)})` : ''
    return new AcpProtocolError(err.code, `${err.message}${tail}`, providerId)
  }
  if (err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'number') {
    return new AcpProtocolError((err as { code: number }).code, err.message, providerId)
  }
  if (err instanceof Error) {
    return err
  }
  return new RuntimeProviderError(`ACP error from ${providerId}: ${serializeUnknown(err)}`)
}

export function formatAcpFailureForUi(err: unknown): string {
  if (err instanceof AcpProtocolError) {
    return err.message
  }
  if (err instanceof RequestError) {
    const tail = err.data !== undefined ? ` (${JSON.stringify(err.data)})` : ''
    return `${err.message}${tail}`
  }
  if (isJsonRpcErrorObject(err)) {
    const tail = err.data !== undefined ? ` (${JSON.stringify(err.data)})` : ''
    return `${err.message}${tail}`
  }
  return serializeUnknown(err)
}
