import { spawn } from 'node:child_process'

export type SpawnResult = { status: number | null; stdout: string; stderr: string }

export function spawnWithTimeout(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number; env?: NodeJS.ProcessEnv },
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })

    const killTimer = setTimeout(() => {
      child.kill('SIGKILL')
    }, options.timeoutMs)

    child.on('error', (err) => {
      clearTimeout(killTimer)
      reject(err)
    })

    child.on('close', (code) => {
      clearTimeout(killTimer)
      resolve({ status: code, stdout, stderr })
    })
  })
}
