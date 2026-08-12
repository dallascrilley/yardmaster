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
2. Be concise and specific to the changes
3. Write exactly one commit message, never a list of alternatives
4. Your entire reply is the commit message and nothing else. Do not announce what
   you are about to do, do not explain your reasoning, do not add a preamble or a
   closing remark, do not wrap it in quotes or markdown code fences, and do not
   add a body. Reply with the single subject line and stop.`

/** How much staged diff to inline before asking the agent to read the rest itself. */
const MAX_INLINE_DIFF_CHARS = 24_000

/**
 * The user turn for `yardmaster commit`.
 *
 * The staged diff is inlined rather than left for the agent to fetch. The
 * command already reads it to check that anything is staged, and an agent that
 * has to run `git diff --staged` first tends to narrate the tool call ("I'll
 * start by checking the staged changes…") into the same message stream as its
 * answer — which is indistinguishable from the answer by the time it reaches
 * `normalizeCommitMessage`. It also removes the dependency on the agent's shell
 * tool being usable, which is not a given inside a sandboxed CI runner.
 */
export function buildCommitPrompt(stagedDiff?: string): string {
  const instruction = 'Generate a Conventional Commits message for the staged changes.'
  const diff = stagedDiff?.trim()
  if (!diff) {
    return `${instruction} Run 'git diff --staged' to see them.`
  }

  if (diff.length > MAX_INLINE_DIFF_CHARS) {
    return [
      instruction,
      '',
      `The staged diff is too large to include in full; here are its first ${MAX_INLINE_DIFF_CHARS} characters.`,
      "Run 'git diff --staged' if you need the rest.",
      '',
      diff.slice(0, MAX_INLINE_DIFF_CHARS),
    ].join('\n')
  }

  return [instruction, '', 'Staged diff:', '', diff].join('\n')
}

/** The first fenced code block in a response, if there is one. */
const FENCED_BLOCK_RE = /```[a-zA-Z0-9_-]*[ \t]*\r?\n?([\s\S]*?)```/

/**
 * A line that introduces the message that follows, e.g. "Here is the commit
 * message:". Announcements end in a colon; a refusal ("I cannot generate a
 * commit message for this diff.") does not, which is what keeps a refusal from
 * being mined for a header.
 */
const ANNOUNCEMENT_LINE_RE = /:$/

/** How many announcement lines may precede the message before it is prose. */
const MAX_PREAMBLE_LINES = 3

export function normalizeCommitMessage(raw: string): string {
  const trimmed = raw.trim()

  // Take the contents of a fenced block wherever it appears, not just when the
  // whole response is one: providers put the message in a fence *after* a
  // sentence at least as often as they fence the entire reply.
  const body = (FENCED_BLOCK_RE.exec(trimmed)?.[1] ?? trimmed).trim()

  if (!body) {
    throw new UsageError('Provider returned an empty commit message.')
  }

  const lines = body.split(/\r?\n/).map((line) => line.trim())
  const firstLine = lines[0] ?? ''
  if (CONVENTIONAL_HEADER_RE.test(firstLine)) {
    return firstLine
  }

  // Some agent CLIs emit an operational notice through the same channel as the
  // model's answer, with no separator: codex-acp forwards Codex's "Model
  // metadata for `<model>` not found" warning as an `agent_message_chunk`, and
  // the model's own "I'll start by checking the staged changes…" narration
  // arrives the same way, so the header lands as "…cause issues.chore: add x".
  // Recover it from the tail of the line, but only for a known Conventional
  // Commits type glued directly to the notice, so this cannot turn arbitrary
  // prose into a commit message.
  const glued = recoverGluedHeader(firstLine)
  if (glued && CONVENTIONAL_HEADER_RE.test(glued)) {
    return glued
  }

  // Finally, allow a short announcement *preamble* on its own lines. Only lines
  // that end in a colon qualify, so an explanation or refusal is still rejected
  // rather than mined for something header-shaped, and a list of alternatives
  // ("1. feat: …") never matches the header pattern on its own line.
  for (let index = 0; index < Math.min(lines.length, MAX_PREAMBLE_LINES + 1); index += 1) {
    const line = lines[index]!
    if (CONVENTIONAL_HEADER_RE.test(line)) {
      return line
    }
    if (line.length > 0 && !ANNOUNCEMENT_LINE_RE.test(line)) {
      break
    }
  }

  throw new UsageError(
    `Provider returned a non-Conventional-Commit message. Raw response: ${summarizeRawMessage(raw)}`,
  )
}

const RAW_SNIPPET_MAX_CHARS = 200

/**
 * One-line, length-capped rendering of a rejected provider response.
 *
 * Without it a CI failure reads only "non-Conventional-Commit message" and the
 * actual output is unrecoverable from the logs. Newlines and control characters
 * are folded to spaces so the snippet cannot break log parsing or inject its own
 * `::error::` workflow command.
 */
export function summarizeRawMessage(raw: string): string {
  const flattened = raw
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (flattened.length === 0) {
    return '(empty)'
  }

  return flattened.length > RAW_SNIPPET_MAX_CHARS
    ? `${flattened.slice(0, RAW_SNIPPET_MAX_CHARS)}… (truncated, ${flattened.length} chars)`
    : flattened
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
