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
  status: 'ok' | 'error'
  latencyMs: number
  review: string
}

export type ReviewExecutionResult = {
  mode: 'single' | 'all'
  agents: ReviewAgentId[]
  source: string
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
  requestRunner?: (params: { input: RunRequestInput; config: GenieConfig }) => Promise<{ response: string }>
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
    `source: ${result.source}`,
    `diff: files=${result.diff.files} additions=${result.diff.additions} deletions=${result.diff.deletions}`,
    '',
  ]

  for (const providerResult of result.results) {
    lines.push(`=== ${providerResult.agent} | ${providerResult.status} | ${providerResult.latencyMs}ms ===`)
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

function tryGitRead(gitRead: GitReadFn, args: string[]): string | null {
  try {
    return gitRead(args)
  } catch {
    return null
  }
}

function buildBaseRefCandidates(gitRead: GitReadFn): string[] {
  const candidates: string[] = []
  const originHead = tryGitRead(gitRead, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])?.trim()
  if (originHead) {
    candidates.push(originHead)
  }
  candidates.push('origin/main', 'origin/master', 'main', 'master')
  return [...new Set(candidates)]
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

  const dirtyOrStaged = tryGitRead(gitRead, ['diff', '--no-color', 'HEAD'])
  if (dirtyOrStaged === null) {
    throw new UsageError('Failed to read git diff from repository context.')
  }
  if (dirtyOrStaged.trim()) {
    return { source: 'git diff HEAD', text: dirtyOrStaged }
  }

  for (const baseRef of buildBaseRefCandidates(gitRead)) {
    const mergeBase = tryGitRead(gitRead, ['merge-base', 'HEAD', baseRef])?.trim()
    if (!mergeBase) continue

    const branchDiff = tryGitRead(gitRead, ['diff', '--no-color', `${mergeBase}...HEAD`])
    if (branchDiff && branchDiff.trim()) {
      return {
        source: `git diff ${baseRef}...HEAD`,
        text: branchDiff,
      }
    }
  }

  return {
    source: 'git diff HEAD',
    text: dirtyOrStaged,
  }
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
  requestRunner: (params: { input: RunRequestInput; config: GenieConfig }) => Promise<{ response: string }>
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
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      review: result.response,
    }
  } catch (error) {
    return {
      agent: params.agent,
      provider,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      review: formatProviderError(error),
    }
  }
}

export async function executeReviewCommand(params: ExecuteReviewCommandParams): Promise<ReviewExecutionResult> {
  const agents = resolveReviewTargets(params.all, params.agent)
  const diff = resolveReviewDiffSource({ diffFile: params.diffFile })
  const diffText = ensureNonEmptyDiff(diff.text)
  const prompt = buildReviewPrompt(diffText)
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
