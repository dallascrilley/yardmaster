import { execFileSync } from 'node:child_process'

import { RuntimeProviderError, UsageError } from '../errors.js'

const GIT_MAX_BUFFER_BYTES = 20 * 1024 * 1024
const CONVENTIONAL_HEADER_RE = /^[a-z]+(?:\([^)]+\))?!?:\s.+$/

export type GitReadFn = (args: string[]) => string
export type GitExecFn = (args: string[]) => void
export type GitWorkspaceOptions = {
  cwd?: string
}

export function createGitRead(options?: GitWorkspaceOptions): GitReadFn {
  return (args: string[]) =>
    execFileSync('git', args, {
      cwd: options?.cwd,
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
    })
}

export function createGitExec(options?: GitWorkspaceOptions): GitExecFn {
  return (args: string[]) =>
    execFileSync('git', args, {
      cwd: options?.cwd,
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
}

export function defaultGitRead(args: string[]): string {
  return createGitRead()(args)
}

export function defaultGitExec(args: string[]): void {
  createGitExec()(args)
}

export function readStagedDiff(gitRead: GitReadFn = defaultGitRead): string {
  try {
    const diff = gitRead(['diff', '--staged', '--no-color'])
    if (!diff.trim()) {
      throw new RuntimeProviderError('No staged changes found. Stage files with git add and retry.')
    }
    return diff
  } catch (error) {
    if (error instanceof RuntimeProviderError) {
      throw error
    }

    const reason = error instanceof Error ? error.message : String(error)
    throw new RuntimeProviderError(`Failed to read staged git diff: ${reason}`)
  }
}

export const COMMIT_SYSTEM_PROMPT = `You are a commit message generator. Follow these rules:
1. Use Conventional Commits syntax (feat:, fix:, chore:, refactor:, docs:, test:, ci:)
2. Return ONLY the commit message, no markdown or code fences
3. Be concise and specific to the changes
4. Run 'git diff --staged' to see the changes
5. Write a single commit message based on the diff`

export function buildCommitPrompt(): string {
  return 'Generate a Conventional Commits message for the staged changes.'
}

export function normalizeCommitMessage(raw: string): string {
  const trimmed = raw.trim()
  const withoutFence = trimmed
    .replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  if (!withoutFence) {
    throw new UsageError('Provider returned an empty commit message.')
  }

  const firstLine = withoutFence.split(/\r?\n/, 1)[0]?.trim() ?? ''
  if (!CONVENTIONAL_HEADER_RE.test(firstLine)) {
    throw new UsageError('Provider returned a non-Conventional-Commit message.')
  }

  return firstLine
}

export function applyCommitMessage(message: string, gitExec: GitExecFn = defaultGitExec): void {
  try {
    gitExec(['commit', '-m', message])
  } catch (error) {
    const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? error.stderr : undefined
    const reason =
      typeof stderr === 'string' && stderr.trim()
        ? stderr.trim()
        : error instanceof Error
          ? error.message
          : String(error)
    throw new RuntimeProviderError(`Failed to create git commit: ${reason}`)
  }
}
