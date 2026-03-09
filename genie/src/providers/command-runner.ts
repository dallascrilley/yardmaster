import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

import {
  type CommandRunner,
  type CommandResult,
  type ProviderInvocation,
} from '../types.js'

export const defaultCommandError: CommandResult = {
  stdout: '',
  stderr: '',
  code: 127,
}

export function isCommandNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function isCwdError(error: unknown, cwd?: string): boolean {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false
  return typeof cwd === 'string' && !existsSync(cwd)
}

function signalExitCode(signal: NodeJS.Signals | null): number {
  if (!signal) return 1
  const signalNumbers: Record<string, number> = {
    SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGTERM: 15, SIGKILL: 9,
  }
  return 128 + (signalNumbers[signal] ?? 1)
}

export function isLikelyTimeout(result: CommandResult): boolean {
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
      if (isCwdError(error, invocation.cwd)) {
        resolve({
          ...defaultCommandError,
          stderr: `Working directory does not exist: ${invocation.cwd}`,
        })
        return
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

    child.on('close', (code, signal) => {
      if (didResolve) return
      didResolve = true
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      resolve({
        stdout,
        stderr,
        code: code ?? signalExitCode(signal),
      })
    })
  })
}

export async function runWithRunner(
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
