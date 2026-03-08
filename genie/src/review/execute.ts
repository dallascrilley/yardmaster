import { type GenieConfig } from '../config/schema.js'
import { runRequest, type RunRequestInput } from '../execution/run-request.js'
import type {
  ReviewExecutionResult,
  ReviewProviderResult,
} from './contracts.js'
import { parseUnifiedDiffStats, mapAgentToProvider } from './format.js'
import { resolveReviewTargets, type ReviewAgentId } from './select.js'
import { resolveReviewDiffSource, ensureNonEmptyDiff } from './diff-source.js'
import { createGitService, type GitService } from './git-service.js'

const REVIEW_TIMEOUT_MS = 120_000

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

function buildReviewPrompt(diffText: string): string {
  return [
    'Perform a code review of this unified diff.',
    'Return findings ordered by severity with file and line references when possible.',
    'Focus on correctness risks, regressions, missing tests, and maintainability concerns.',
    '',
    diffText,
  ].join('\n')
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
  workspace: string
  requestRunner: (params: { input: RunRequestInput; config: GenieConfig }) => Promise<{ response: string; model?: string }>
}): Promise<ReviewProviderResult> {
  const startedAt = Date.now()
  const provider = mapAgentToProvider(params.agent)
  try {
    const result = await params.requestRunner({
      input: {
        prompt: params.prompt,
        provider,
        workspace: params.workspace,
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
  const cwd = process.cwd()
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
      workspace: cwd,
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
    cwd,
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
