export type CliJsonError = {
  code: string
  message: string
}

export type CliJsonSuccessEnvelope<T extends Record<string, unknown>> = T & {
  kind: string
  version: 1
  ok: boolean
  exitCode: number
  error: null
}

export type CliJsonErrorEnvelope = {
  kind: 'error'
  version: 1
  ok: false
  exitCode: number
  error: CliJsonError
}

export function toCliJsonSuccessEnvelope<T extends Record<string, unknown>>(
  kind: string,
  payload: T,
  exitCode = 0,
): CliJsonSuccessEnvelope<T> {
  return {
    ...payload,
    kind,
    version: 1,
    ok: exitCode === 0,
    exitCode,
    error: null,
  }
}

export function toCliJsonErrorEnvelope(exitCode: number, error: CliJsonError): CliJsonErrorEnvelope {
  return {
    kind: 'error',
    version: 1,
    ok: false,
    exitCode,
    error,
  }
}
