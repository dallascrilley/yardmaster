import { execFileSync } from 'node:child_process'

import { RuntimeProviderError, UsageError } from '../errors.js'

const GIT_MAX_BUFFER_BYTES = 20 * 1024 * 1024

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

export function buildCommitPrompt(diff: string): string {
  return [
    'Write a single Conventional Commits message for the staged git diff.',
    'Use Conventional Commits syntax such as feat:, fix:, chore:, refactor:, docs:, test:, or ci:.',
    'Return only the commit message text.',
    'Do not wrap the message in markdown or code fences.',
    'Keep it concise and specific to the staged changes.',
    '',
    'Staged diff:',
    '```diff',
    diff,
    '```',
  ].join('\n')
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

  return withoutFence
}

export function applyCommitMessage(message: string, gitExec: GitExecFn = defaultGitExec): void {
  try {
    gitExec(['commit', '-m', message])
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new RuntimeProviderError(`Failed to create git commit: ${reason}`)
  }
}
