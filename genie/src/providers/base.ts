import { spawn } from 'node:child_process'

import {
  type CommandRunner,
  type NormalizedRequest,
  type ProviderAdapter,
  type ProviderInvocation,
  type ProviderParseResult,
  type CommandResult,
  type ProviderCheckResult,
} from '../types.js'

export type ProviderFactoryParams = {
  id: ProviderAdapter['id']
  binary: string
  buildInvocation: (request: NormalizedRequest) => ProviderInvocation
  parse: (result: CommandResult) => ProviderParseResult
  availabilityInvocation?: ProviderInvocation
  availabilityCheck?: (runner: CommandRunner) => Promise<ProviderCheckResult>
  authCheck?: (runner: CommandRunner) => Promise<ProviderCheckResult>
}

const defaultCommandError: CommandResult = {
  stdout: '',
  stderr: '',
  code: 127,
}

const DEFAULT_EXECUTION_TIMEOUT_MS = 30_000
const DEFAULT_AVAILABILITY_TIMEOUT_MS = 3_000
const RETRY_AVAILABILITY_TIMEOUT_MS = 6_000

function isCommandNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function isLikelyTimeout(result: CommandResult): boolean {
  return result.code === 124 || /timed out/i.test(`${result.stderr}\n${result.stdout}`)
}

export async function runCommand(invocation: ProviderInvocation, runner?: CommandRunner): Promise<CommandResult> {
  if (runner) {
    return runner(invocation)
  }

  return new Promise<CommandResult>((resolve) => {
    let didResolve = false
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    const timeoutHandle =
      typeof invocation.timeoutMs === 'number' && invocation.timeoutMs > 0
        ? setTimeout(() => {
            if (didResolve) return
            didResolve = true
            child.kill('SIGTERM')
            setTimeout(() => {
              child.kill('SIGKILL')
            }, 250)
            child.stdout?.destroy()
            child.stderr?.destroy()
            child.unref()
            resolve({
              stdout,
              stderr: `${stderr}\nTimed out after ${invocation.timeoutMs}ms`.trim(),
              code: 124,
            })
          }, invocation.timeoutMs)
        : undefined

    child.on('error', (error) => {
      if (didResolve) return
      didResolve = true
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      if (isCommandNotFound(error)) {
        resolve({
          ...defaultCommandError,
          stderr: error.message,
        })
        return
      }

      resolve({
        ...defaultCommandError,
        stderr: String(error),
      })
    })

    child.on('close', (code) => {
      if (didResolve) return
      didResolve = true
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      resolve({
        stdout,
        stderr,
        code: code ?? 0,
      })
    })
  })
}

function createDefaultAvailabilityCheck(binary: string, invocation?: ProviderInvocation) {
  return async (runner: CommandRunner): Promise<ProviderCheckResult> => {
    const baseInvocation =
      invocation ?? {
        command: binary,
        args: ['--version'],
        timeoutMs: DEFAULT_AVAILABILITY_TIMEOUT_MS,
      }
    let result = await runner(baseInvocation)

    // Retry once with a longer timeout when the first probe times out.
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

function createDefaultAuthCheck(id: string, binary: string) {
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

export function extractResponseText(result: CommandResult, fallbackLabel: string): string {
  const stdout = result.stdout.trim()
  const stderr = result.stderr.trim()
  if (stdout) return stdout

  const nonDiagnosticStderr = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^warning[:\s]/i.test(line))

  if (nonDiagnosticStderr.length > 0) {
    return nonDiagnosticStderr.join('\n')
  }

  return `No response from ${fallbackLabel}`
}

export function createProviderAdapter(params: ProviderFactoryParams): ProviderAdapter {
  async function runWithRunner(
    runner: CommandRunner,
    invocation: ProviderInvocation,
  ): Promise<CommandResult> {
    try {
      return await runner(invocation)
    } catch (error) {
      if (isCommandNotFound(error)) {
        return {
          ...defaultCommandError,
          stderr: (error as Error).message,
        }
      }

      return {
        ...defaultCommandError,
        stderr: String(error),
      }
    }
  }

  const availabilityCheck =
    params.availabilityCheck ??
    createDefaultAvailabilityCheck(params.binary, params.availabilityInvocation)

  const authCheck = params.authCheck ?? createDefaultAuthCheck(params.id, params.binary)

  return {
    id: params.id,
    isAvailable: async (runner = runCommand) => {
      return availabilityCheck((invocation) => runWithRunner(runner, invocation))
    },
    isAuthenticated: async (runner = runCommand) => {
      return authCheck((invocation) => runWithRunner(runner, invocation))
    },
    buildInvocation: params.buildInvocation,
    execute: async (request: NormalizedRequest, runner = runCommand) => {
      const invocation = params.buildInvocation(request)
      const result = await runWithRunner(runner, {
        ...invocation,
        timeoutMs: invocation.timeoutMs ?? request.timeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS,
      })

      if (result.code !== 0) {
        const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
        throw new Error(`${params.id} execution failed (${result.code}): ${detail || 'no output'}`)
      }

      return params.parse(result)
    },
    parse: params.parse,
  }
}
