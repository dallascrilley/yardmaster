import {
  type CommandRunner,
  type NormalizedRequest,
  type ProviderAdapter,
  type ProviderInvocation,
  type ProviderParseResult,
  type CommandResult,
  type ProviderCheckResult,
} from '../types.js'
import { runCommand, runWithRunner } from './command-runner.js'
import { createDefaultAuthCheck, createDefaultAvailabilityCheck } from './default-checks.js'

export { runCommand } from './command-runner.js'

export type ProviderFactoryParams = {
  id: ProviderAdapter['id']
  binary: string
  buildInvocation: (request: NormalizedRequest) => ProviderInvocation
  parse: (result: CommandResult) => ProviderParseResult
  availabilityInvocation?: ProviderInvocation
  availabilityCheck?: (runner: CommandRunner) => Promise<ProviderCheckResult>
  authCheck?: (runner: CommandRunner) => Promise<ProviderCheckResult>
}

const DEFAULT_EXECUTION_TIMEOUT_MS = 120_000

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
