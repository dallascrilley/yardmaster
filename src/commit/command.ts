import { execFileSync } from 'node:child_process'

import { RuntimeProviderError, UsageError } from '../errors.js'

const GIT_MAX_BUFFER_BYTES = 20 * 1024 * 1024
const CONVENTIONAL_HEADER_RE = /^[a-z]+(?:\([^)]+\))?!?:\s.+$/

/**
 * The Conventional Commits types recognized when recovering a header that an
 * agent CLI glued to the end of a notice — deliberately a closed set, unlike
 * `CONVENTIONAL_HEADER_RE`, which accepts any lowercase word as a type.
 */
const CONVENTIONAL_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
] as const

/**
 * Locates a Conventional Commits header occupying the tail of a line.
 *
 * The character in front of the type must be neither an identifier character
 * nor whitespace. That is the whole point: this recovers a header a CLI *glued*
 * onto the end of a notice ("…cause issues.chore: add x"), and refuses one that
 * merely follows prose with a space ("here is a fix: delete everything"), which
 * is a refusal, not a commit message.
 *
 * The lookahead keeps the captured header out of the consumed match so a `g`
 * scan can walk every candidate position instead of stopping at the leftmost.
 */
const EMBEDDED_HEADER_SCAN = new RegExp(
  `[^\\sA-Za-z0-9_-](?=((?:${CONVENTIONAL_TYPES.join('|')})(?:\\([^)]+\\))?!?:\\s.+)$)`,
  'g',
)

/** The rightmost Conventional Commits header glued to the end of `line`. */
function recoverGluedHeader(line: string): string | undefined {
  EMBEDDED_HEADER_SCAN.lastIndex = 0
  let candidate: string | undefined
  let match: RegExpExecArray | null

  while ((match = EMBEDDED_HEADER_SCAN.exec(line)) !== null) {
    candidate = match[1]
    EMBEDDED_HEADER_SCAN.lastIndex = match.index + 1
  }

  return candidate?.trim()
}

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
  if (CONVENTIONAL_HEADER_RE.test(firstLine)) {
    return firstLine
  }

  // Some agent CLIs emit an operational notice through the same channel as the
  // model's answer, with no separator: codex-acp forwards Codex's "Model
  // metadata for `<model>` not found" warning as an `agent_message_chunk`, so
  // the header arrives as "…cause issues.chore: add version.txt". Recover the
  // header from the tail of the first line, but only for a known Conventional
  // Commits type glued directly to the notice, so this cannot turn arbitrary
  // prose into a commit message. A notice on its own *line* is still rejected:
  // a provider that wraps its answer in explanation has not followed the
  // instructions, and silently committing one of its lines would be worse than
  // failing.
  const glued = recoverGluedHeader(firstLine)
  if (glued && CONVENTIONAL_HEADER_RE.test(glued)) {
    return glued
  }

  throw new UsageError('Provider returned a non-Conventional-Commit message.')
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
