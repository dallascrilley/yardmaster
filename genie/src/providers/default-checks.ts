import {
  type CommandRunner,
  type ProviderCheckResult,
  type ProviderInvocation,
} from '../types.js'
import { isLikelyTimeout } from './command-runner.js'

const DEFAULT_AVAILABILITY_TIMEOUT_MS = 3_000
const RETRY_AVAILABILITY_TIMEOUT_MS = 6_000

export function createDefaultAvailabilityCheck(binary: string, invocation?: ProviderInvocation) {
  return async (runner: CommandRunner): Promise<ProviderCheckResult> => {
    const baseInvocation: ProviderInvocation = invocation
      ? {
          command: invocation.command,
          args: invocation.args,
          cwd: invocation.cwd,
          timeoutMs: invocation.timeoutMs ?? DEFAULT_AVAILABILITY_TIMEOUT_MS,
          env: invocation.env,
        }
      : {
          command: binary,
          args: ['--version'],
          timeoutMs: DEFAULT_AVAILABILITY_TIMEOUT_MS,
        }
    let result = await runner(baseInvocation)

    if (isLikelyTimeout(result)) {
      result = await runner({
        ...baseInvocation,
        timeoutMs: RETRY_AVAILABILITY_TIMEOUT_MS,
      })
    }

    if (result.code !== 0) {
      return {
        ok: false,
        reason: `Unable to execute ${binary} ${(invocation?.args || ['--version']).join(' ')}`,
        hint: result.stderr || result.stdout || `Install ${binary} and ensure it is in your PATH.`,
        code: result.code,
        timeout: isLikelyTimeout(result),
      }
    }

    return {
      ok: true,
      details: (result.stdout || result.stderr).trim() || undefined,
    }
  }
}

export function createDefaultAuthCheck(id: string, binary: string) {
  return async (runner: CommandRunner): Promise<ProviderCheckResult> => {
    const result = await runner({
      command: binary,
      args: ['auth', 'status'],
      timeoutMs: 4_000,
    })

    if (result.code === 0) {
      return {
        ok: true,
        details: (result.stdout || result.stderr).trim() || undefined,
      }
    }

    return {
      ok: false,
      reason: `${id} authentication check failed`,
      hint: result.stderr || result.stdout || 'Authenticate with the provider CLI and retry.',
      authFailure: true,
      timeout: isLikelyTimeout(result),
      code: result.code,
    }
  }
}
