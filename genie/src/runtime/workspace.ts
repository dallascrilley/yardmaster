import { statSync } from 'node:fs'

export function resolveWorkspacePath(input: string | undefined, lastWorkspace: string | undefined): string {
  if (input) return input
  if (lastWorkspace) return lastWorkspace
  return process.cwd()
}

export function isUsableWorkspace(path: string): boolean {
  try {
    const stat = statSync(path)
    return stat.isDirectory()
  } catch {
    return false
  }
}
