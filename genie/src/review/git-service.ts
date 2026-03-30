import { execFileSync } from 'node:child_process'

import { resolveGitContext } from './git-context.js'
import { resolveGitDiffSource } from './git-diff.js'

const GIT_MAX_BUFFER_BYTES = 20 * 1024 * 1024

export type GitContext = {
  branch: string | null
  head: string | null
}

export type GitDiffSource = {
  source: string
  text: string
}

export type GitReadFn = (args: string[]) => string

export type GitService = {
  read: GitReadFn
  resolveContext: () => GitContext
  resolveWorkspace?: () => string
  resolveDiffSource: (params?: { staged?: boolean; base?: string }) => GitDiffSource
}

export function defaultGitRead(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

export function createGitService(params?: { gitRead?: GitReadFn }): GitService {
  const gitRead = params?.gitRead ?? defaultGitRead
  return {
    read: gitRead,
    resolveContext: () => resolveGitContext(gitRead),
    resolveWorkspace: () => {
      try {
        return gitRead(['rev-parse', '--show-toplevel']).trim() || process.cwd()
      } catch {
        return process.cwd()
      }
    },
    resolveDiffSource: (resolveParams?: { staged?: boolean; base?: string }) =>
      resolveGitDiffSource(gitRead, resolveParams),
  }
}
