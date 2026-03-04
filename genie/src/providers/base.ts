import { spawn } from 'node:child_process'

import {
  type CommandInvocation,
  type CommandResult,
  type CommandRunner,
  type NormalizedRequest,
  type ProviderAdapter,
  type ProviderCheckResult,
  type ProviderParseResult,
} from '../types.js'

const isCommandNotFoundError = (error: unknown): boolean => {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

export const DEFAULT_NOOP_RESULT: CommandResult = {
  stdout: '',
  stderr: '',
  code: 127,
}

export async function runCommand(invocation: ProviderInvocation, runner?: CommandRunner): Promise<CommandResult> {
  if (runner) return runner(invocation)

  return new Promise((resolve) => {
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

    child.on('error', () => {
      resolve(DEFAULT_NOOP_RESULT)
    })

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        code: code ?? 0,
      })
    })
  })
}

function buildDefaultCheckFailure(binary: string) {
  return {
    ok: false as const,
    reason: `${binary} is not available on PATH`,
    hint: `Run: which ${binary}`,
  }
}

export function createProviderAdapter(params: {
  id: ProviderAdapter['id']
  binary: string
  buildInvocation: (request: NormalizedRequest) => CommandInvocation
  parse: (result: CommandResult) => ProviderParseResult
}): ProviderAdapter {
  const invoke = async (
    request: NormalizedRequest,
    runner: CommandRunner = runCommand,
  ): Promise<ProviderParseResult> => {
    const invocation = params.buildInvocation(request)
    const raw = await runWithRunner(runner, invocation)

    if (raw.code !== 0) {
      throw new Error(raw.stderr.trim() || raw.stdout.trim() || `${params.id} exited with ${raw.code}`)
    }

    return params.parse(raw)
  }

  const runWithRunner = async (runner: CommandRunner, invocation: CommandInvocation): Promise<CommandResult> => {
    try {
      const result = await runner(invocation)
      return result
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return { ...DEFAULT_NOOP_RESULT, stderr: String(error) }
      }
      throw error
    }
  }

  return {
    id: params.id,
    isAvailable: async (runner = runCommand) => {
      const result = await runWithRunner(runner, {
        command: params.binary,
        args: ['--version'],
      })
      if (result.code !== 0) {
        return {
          ...buildDefaultCheckFailure(params.binary),
          reason: `Unable to execute ${params.binary} --version`,
          hint: result.stderr.trim() || result.stdout.trim(),
        }
      }
      return { ok: true }
    },
    isAuthenticated: async (runner = runCommand) => {
      const result = await runWithRunner(runner, {
        command: params.binary,
        args: ['auth', 'status'],
      })
      if (result.code === 0) return { ok: true }
      return {
        ok: false,
        reason: `${params.id} auth check failed`,
        hint: result.stderr.trim() || 'Run the provider login flow to authenticate.',
      }
    },
    buildInvocation: params.buildInvocation,
    execute: invoke,
    parse: params.parse,
  }
}

