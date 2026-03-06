import { readFileSync } from 'node:fs'

import { UsageError } from '../errors.js'
import { type GenieConfig } from '../config/schema.js'
import { runRequest, type RunRequestInput } from '../execution/run-request.js'
import { type ProviderId } from '../types.js'
import { createGitService, type GitReadFn, type GitService } from './git-service.js'

export const reviewAgentIds = ['codex', 'claude', 'gemini', 'cursor'] as const
export type ReviewAgentId = (typeof reviewAgentIds)[number]
const REVIEW_TIMEOUT_MS = 120_000

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

export type ReviewJsonEnvelope = {
  kind: 'review_result'
  version: 1
  mode: 'single' | 'all'
  targets: ReviewAgentId[]
  source: string
  cwd: string
  git: {
    branch: string | null
    head: string | null
  }
  diff: ReviewDiffStats
  summary: {
    total: number
    succeeded: number
    failed: number
  }
  results: Array<{
    agent: ReviewAgentId
    provider: ProviderId
    model: string | null
    status: 'ok' | 'error'
    latencyMs: number
    responseChars: number
    review: string
  }>
  exitCode: 0 | 1
}

export type ReviewJsonSchema = Record<string, unknown>

export type ExecuteReviewCommandParams = {
  all: boolean
  agent?: ReviewAgentId
  diffFile?: string
  staged?: boolean
  base?: string
  config: GenieConfig
  requestRunner?: (params: { input: RunRequestInput; config: GenieConfig }) => Promise<{
    response: string
    model?: string
  }>
  gitService?: GitService
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

export function toReviewJsonEnvelope(result: ReviewExecutionResult): ReviewJsonEnvelope {
  return {
    kind: 'review_result',
    version: 1,
    mode: result.mode,
    targets: [...result.agents],
    source: result.source,
    cwd: result.cwd,
    git: {
      branch: result.git.branch,
      head: result.git.head,
    },
    diff: {
      files: result.diff.files,
      additions: result.diff.additions,
      deletions: result.diff.deletions,
    },
    summary: {
      total: result.summary.total,
      succeeded: result.summary.succeeded,
      failed: result.summary.failed,
    },
    results: result.results.map((item) => ({
      agent: item.agent,
      provider: item.provider,
      model: item.model,
      status: item.status,
      latencyMs: item.latencyMs,
      responseChars: item.responseChars,
      review: item.review,
    })),
    exitCode: result.exitCode,
  }
}

export function getReviewJsonSchema(): ReviewJsonSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://genie-cli.dev/schemas/review-result-v1.json',
    title: 'Genie Review Result',
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'version', 'ok', 'mode', 'targets', 'source', 'cwd', 'git', 'diff', 'summary', 'results', 'exitCode', 'error'],
    properties: {
      kind: { const: 'review_result' },
      version: { const: 1 },
      ok: { type: 'boolean' },
      mode: { enum: ['single', 'all'] },
      targets: {
        type: 'array',
        items: { enum: [...reviewAgentIds] },
      },
      source: { type: 'string' },
      cwd: { type: 'string' },
      git: {
        type: 'object',
        additionalProperties: false,
        required: ['branch', 'head'],
        properties: {
          branch: { type: ['string', 'null'] },
          head: { type: ['string', 'null'] },
        },
      },
      diff: {
        type: 'object',
        additionalProperties: false,
        required: ['files', 'additions', 'deletions'],
        properties: {
          files: { type: 'number' },
          additions: { type: 'number' },
          deletions: { type: 'number' },
        },
      },
      summary: {
        type: 'object',
        additionalProperties: false,
        required: ['total', 'succeeded', 'failed'],
        properties: {
          total: { type: 'number' },
          succeeded: { type: 'number' },
          failed: { type: 'number' },
        },
      },
      results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['agent', 'provider', 'model', 'status', 'latencyMs', 'responseChars', 'review'],
          properties: {
            agent: { enum: [...reviewAgentIds] },
            provider: { enum: ['claude', 'codex', 'cursor-agent', 'gemini'] },
            model: { type: ['string', 'null'] },
            status: { enum: ['ok', 'error'] },
            latencyMs: { type: 'number' },
            responseChars: { type: 'number' },
            review: { type: 'string' },
          },
        },
      },
      exitCode: { enum: [0, 1] },
      error: { type: 'null' },
    },
  }
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

type FileReadFn = (path: string, encoding: BufferEncoding) => string

function defaultFileRead(path: string, encoding: BufferEncoding): string {
  return readFileSync(path, encoding)
}

export function resolveReviewDiffSource(params?: {
  diffFile?: string
  staged?: boolean
  base?: string
  gitService?: GitService
  gitRead?: GitReadFn
  fileRead?: FileReadFn
}): { source: string; text: string } {
  const gitService = params?.gitService ?? createGitService({ gitRead: params?.gitRead })
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

  if (params?.staged) {
    return gitService.resolveDiffSource({ staged: true })
  }

  if (params?.base) {
    return gitService.resolveDiffSource({ base: params.base })
  }

  return gitService.resolveDiffSource()
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
  const gitService = params.gitService ?? createGitService()
  const diff = resolveReviewDiffSource({
    diffFile: params.diffFile,
    staged: params.staged,
    base: params.base,
    gitService,
  })
  const diffText = ensureNonEmptyDiff(diff.text)
  const prompt = buildReviewPrompt(diffText)
  const git = gitService.resolveContext()
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
