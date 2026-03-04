import { spawn } from 'node:child_process'

import {
  type CommandRunner,
  type NormalizedRequest,
  type ProviderAdapter,
  type ProviderInvocation,
  type ProviderParseResult,
  type CommandResult,
} from '../types.js'

export type ProviderFactoryParams = {
  id: ProviderAdapter['id']
  binary: string
  buildInvocation: (request: NormalizedRequest) => ProviderInvocation
  parse: (result: CommandResult) => ProviderParseResult
}

const defaultCommandError: CommandResult = {
  stdout: '',
  stderr: '',
  code: 127,
}

function isCommandNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

export async function runCommand(invocation: ProviderInvocation, runner?: CommandRunner): Promise<CommandResult> {
  if (runner) {
    return runner(invocation)
  }

  return new Promise<CommandResult>((resolve) => {
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

    child.on('error', (error) => {
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
      resolve({
        stdout,
        stderr,
        code: code ?? 0,
      })
    })
  })
}

function buildCheckFailure(binary: string) {
  return {
    ok: false as const,
    reason: `${binary} is not available on PATH`,
    hint: `Install ${binary} and ensure it is in your PATH.`,
  }
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

  return {
    id: params.id,
    isAvailable: async (runner = runCommand) => {
      const result = await runWithRunner(runner, {
        command: params.binary,
        args: ['--version'],
      })

      if (result.code !== 0) {
        return {
          ...buildCheckFailure(params.binary),
          reason: `Unable to execute ${params.binary} --version`,
          hint: result.stderr || result.stdout || undefined,
          code: result.code,
        }
      }

      return { ok: true }
    },
    isAuthenticated: async (runner = runCommand) => {
      const result = await runWithRunner(runner, {
        command: params.binary,
        args: ['auth', 'status'],
      })

      if (result.code === 0) {
        return { ok: true }
      }

      return {
        ok: false,
        reason: `${params.id} authentication check failed`,
        hint: result.stderr || result.stdout || 'Authenticate with the provider CLI and retry.',
      }
    },
    buildInvocation: params.buildInvocation,
    execute: async (request: NormalizedRequest, runner = runCommand) => {
      const invocation = params.buildInvocation(request)
      const result = await runWithRunner(runner, invocation)

      if (result.code !== 0) {
        const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
        throw new Error(`${params.id} execution failed (${result.code}): ${detail || 'no output'}`)
      }

      return params.parse(result)
    },
    parse: params.parse,
  }
}
