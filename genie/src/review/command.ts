import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { UsageError } from '../errors.js'
import { type GenieConfig } from '../config/schema.js'
import { runRequest, type RunRequestInput } from '../execution/run-request.js'
import { type ProviderId } from '../types.js'

export const reviewAgentIds = ['codex', 'claude', 'gemini', 'cursor'] as const
export type ReviewAgentId = (typeof reviewAgentIds)[number]
const REVIEW_TIMEOUT_MS = 120_000
const GIT_MAX_BUFFER_BYTES = 20 * 1024 * 1024

export type ReviewDiffStats = {
  files: number
  additions: number
  deletions: number
}

export type ReviewProviderResult = {
  agent: ReviewAgentId
  provider: ProviderId
  model: string | null
  status: 'ok' | 'error'
  latencyMs: number
  responseChars: number
  review: string
}

export type ReviewExecutionResult = {
  mode: 'single' | 'all'
  agents: ReviewAgentId[]
  source: string
  cwd: string
  git: {
    branch: string | null
    head: string | null
  }
  diff: ReviewDiffStats
  results: ReviewProviderResult[]
  summary: {
    total: number
    succeeded: number
    failed: number
  }
  exitCode: 0 | 1
}

export type ExecuteReviewCommandParams = {
  all: boolean
  agent?: ReviewAgentId
  diffFile?: string
  config: GenieConfig
  requestRunner?: (params: { input: RunRequestInput; config: GenieConfig }) => Promise<{
    response: string
    model?: string
  }>
}

export function parseReviewAgent(value: string): ReviewAgentId {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'cursor-agent') {
    return 'cursor'
  }

  if (!reviewAgentIds.includes(normalized as ReviewAgentId)) {
    throw new UsageError(`Unknown agent '${value}' for --agent`)
  }

  return normalized as ReviewAgentId
}

export function resolveReviewTargets(all: boolean, agent?: ReviewAgentId): ReviewAgentId[] {
  if (all && agent) {
    throw new UsageError('--all cannot be used with --agent')
  }
  if (!all && !agent) {
    throw new UsageError('A review target is required. Use --all or --agent <codex|claude|gemini|cursor>.')
  }
  if (all) {
    return ['codex', 'claude', 'gemini', 'cursor']
  }
  return [agent as ReviewAgentId]
}

export function parseUnifiedDiffStats(diffText: string): ReviewDiffStats {
  const lines = diffText.split('\n')
  let files = 0
  let additions = 0
  let deletions = 0

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      files += 1
      continue
    }
    if (line.startsWith('+++') || line.startsWith('---')) {
      continue
    }
    if (line.startsWith('+')) {
      additions += 1
      continue
    }
    if (line.startsWith('-')) {
      deletions += 1
    }
  }

  return { files, additions, deletions }
}

export function formatReviewReport(result: ReviewExecutionResult): string {
  const lines: string[] = [
    `mode: ${result.mode}`,
    `targets: ${result.agents.join(', ')}`,
    `cwd: ${result.cwd}`,
    `branch: ${result.git.branch ?? 'unknown'}`,
    `head: ${result.git.head ?? 'unknown'}`,
    `source: ${result.source}`,
    `diff: files=${result.diff.files} additions=${result.diff.additions} deletions=${result.diff.deletions}`,
    '',
  ]

  for (const providerResult of result.results) {
    lines.push(
      `=== ${providerResult.agent} | provider=${providerResult.provider} model=${providerResult.model ?? 'unknown'} | ${providerResult.status} | ${providerResult.latencyMs}ms | chars=${providerResult.responseChars} ===`,
    )
    lines.push(providerResult.review.trim() || '(no output)')
    lines.push('')
  }

  lines.push(`summary: success=${result.summary.succeeded}/${result.summary.total} failed=${result.summary.failed}`)
  return lines.join('\n')
}

function mapAgentToProvider(agent: ReviewAgentId): ProviderId {
  if (agent === 'cursor') {
    return 'cursor-agent'
  }
  return agent
}

function buildReviewPrompt(diffText: string): string {
  return [
    'Perform a code review of this unified diff.',
    'Return findings ordered by severity with file and line references when possible.',
    'Focus on correctness risks, regressions, missing tests, and maintainability concerns.',
    '',
    diffText,
  ].join('\n')
}

type GitReadFn = (args: string[]) => string
type FileReadFn = (path: string, encoding: BufferEncoding) => string

function defaultGitRead(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  })
}

function defaultFileRead(path: string, encoding: BufferEncoding): string {
  return readFileSync(path, encoding)
}

type GitReadResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

function safeGitRead(gitRead: GitReadFn, args: string[]): GitReadResult {
  try {
    return { ok: true, text: gitRead(args) }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, error: reason }
  }
}

function resolveGitContext(gitRead: GitReadFn): { branch: string | null; head: string | null } {
  const branchResult = safeGitRead(gitRead, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const headResult = safeGitRead(gitRead, ['rev-parse', '--short', 'HEAD'])
  const branch = branchResult.ok ? branchResult.text.trim() || null : null
  const head = headResult.ok ? headResult.text.trim() || null : null
  return { branch, head }
}

function buildBaseRefCandidates(gitRead: GitReadFn): string[] {
  const candidates: string[] = []
  const upstream = safeGitRead(gitRead, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  if (upstream.ok && upstream.text.trim()) {
    candidates.push(upstream.text.trim())
  }

  candidates.push('main', 'master', 'origin/main', 'origin/master')

  const originHead = safeGitRead(gitRead, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
  if (originHead.ok && originHead.text.trim()) {
    candidates.push(originHead.text.trim())
  }

  return [...new Set(candidates)]
}

function isUnbornHeadError(message: string): boolean {
  return /unknown revision or path not in the working tree|bad revision 'HEAD'|ambiguous argument 'HEAD'|not a valid object name HEAD/i.test(
    message,
  )
}

function loadHeadDiffWithUnbornFallback(gitRead: GitReadFn): { source: string; text: string } {
  const againstHead = safeGitRead(gitRead, ['diff', '--no-color', 'HEAD'])
  if (againstHead.ok) {
    return { source: 'git diff HEAD', text: againstHead.text }
  }

  if (!isUnbornHeadError(againstHead.error)) {
    throw new UsageError(`Failed to read git diff HEAD: ${againstHead.error}`)
  }

  const cached = safeGitRead(gitRead, ['diff', '--no-color', '--cached'])
  const working = safeGitRead(gitRead, ['diff', '--no-color'])

  const parts: string[] = []
  if (cached.ok && cached.text.trim()) parts.push(cached.text)
  if (working.ok && working.text.trim()) parts.push(working.text)

  if (parts.length > 0) {
    return {
      source: 'git diff --cached + git diff',
      text: parts.join('\n'),
    }
  }

  if (!cached.ok && !working.ok) {
    throw new UsageError(
      `Failed to read git diff for repository without commits. cached: ${cached.error}. working: ${working.error}`,
    )
  }

  return {
    source: 'git diff --cached + git diff',
    text: '',
  }
}

export function resolveReviewDiffSource(params?: {
  diffFile?: string
  gitRead?: GitReadFn
  fileRead?: FileReadFn
}): { source: string; text: string } {
  const gitRead = params?.gitRead ?? defaultGitRead
  const fileRead = params?.fileRead ?? defaultFileRead

  if (params?.diffFile) {
    try {
      const text = fileRead(params.diffFile, 'utf8')
      return { source: `file:${params.diffFile}`, text }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new UsageError(`Unable to read --diff-file '${params.diffFile}': ${reason}`)
    }
  }

  const dirtyOrStaged = loadHeadDiffWithUnbornFallback(gitRead)
  if (dirtyOrStaged.text.trim()) {
    return dirtyOrStaged
  }

  const candidateErrors: string[] = []
  let successfulCandidateReads = 0
  for (const baseRef of buildBaseRefCandidates(gitRead)) {
    const mergeBaseResult = safeGitRead(gitRead, ['merge-base', 'HEAD', baseRef])
    if (!mergeBaseResult.ok) {
      candidateErrors.push(`${baseRef}: ${mergeBaseResult.error}`)
      continue
    }

    const mergeBase = mergeBaseResult.text.trim()
    if (!mergeBase) continue

    const branchDiffResult = safeGitRead(gitRead, ['diff', '--no-color', `${mergeBase}...HEAD`])
    if (!branchDiffResult.ok) {
      candidateErrors.push(`${baseRef}: ${branchDiffResult.error}`)
      continue
    }
    successfulCandidateReads += 1

    if (branchDiffResult.text.trim()) {
      return {
        source: `git diff ${baseRef}...HEAD`,
        text: branchDiffResult.text,
      }
    }
  }

  if (successfulCandidateReads === 0 && candidateErrors.length > 0) {
    throw new UsageError(
      `Failed to resolve base branch diff candidates:\n- ${candidateErrors.slice(0, 4).join('\n- ')}`,
    )
  }

  return dirtyOrStaged
}

function ensureNonEmptyDiff(text: string): string {
  const normalized = text.trim()
  if (!normalized) {
    throw new UsageError(
      'No changes to review. Provide --diff-file <path>, create local changes, or switch to a branch with commits.',
    )
  }
  return text
}

function formatProviderError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

async function runReviewForAgent(params: {
  agent: ReviewAgentId
  prompt: string
  config: GenieConfig
  requestRunner: (params: { input: RunRequestInput; config: GenieConfig }) => Promise<{ response: string; model?: string }>
}): Promise<ReviewProviderResult> {
  const startedAt = Date.now()
  const provider = mapAgentToProvider(params.agent)
  try {
    const result = await params.requestRunner({
      input: {
        prompt: params.prompt,
        provider,
        noFallback: true,
        output: 'plain',
        timeoutMs: REVIEW_TIMEOUT_MS,
      },
      config: params.config,
    })

    return {
      agent: params.agent,
      provider,
      model: result.model ?? null,
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      responseChars: result.response.length,
      review: result.response,
    }
  } catch (error) {
    const message = formatProviderError(error)
    return {
      agent: params.agent,
      provider,
      model: null,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      responseChars: message.length,
      review: message,
    }
  }
}

export async function executeReviewCommand(params: ExecuteReviewCommandParams): Promise<ReviewExecutionResult> {
  const agents = resolveReviewTargets(params.all, params.agent)
  const diff = resolveReviewDiffSource({ diffFile: params.diffFile })
  const diffText = ensureNonEmptyDiff(diff.text)
  const prompt = buildReviewPrompt(diffText)
  const git = resolveGitContext(defaultGitRead)
  const runner = params.requestRunner ?? ((requestParams: { input: RunRequestInput; config: GenieConfig }) =>
    runRequest({
      ...requestParams,
      persistLastUsed: false,
    }))

  const tasks = agents.map((agent) =>
    runReviewForAgent({
      agent,
      prompt,
      config: params.config,
      requestRunner: runner,
    }),
  )
  const results = await Promise.all(tasks)
  const succeeded = results.filter((item) => item.status === 'ok').length
  const failed = results.length - succeeded

  return {
    mode: params.all ? 'all' : 'single',
    agents,
    source: diff.source,
    cwd: process.cwd(),
    git,
    diff: parseUnifiedDiffStats(diffText),
    results,
    summary: {
      total: results.length,
      succeeded,
      failed,
    },
    exitCode: failed > 0 ? 1 : 0,
  }
}
