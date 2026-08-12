import { type YardmasterConfig } from '../config/schema.js'
import type {
  ReviewExecutionResult,
  ReviewProviderResult,
} from './contracts.js'
import { parseUnifiedDiffStats, mapAgentToProvider } from './format.js'
import { resolveReviewTargets, type ReviewAgentId } from './select.js'
import { resolveReviewDiffSource, ensureNonEmptyDiff } from './diff-source.js'
import { createGitService, type GitService } from './git-service.js'
import { runAcpCommand } from '../acp/command-runner.js'
import type { TrustMode } from '../acp/host-handlers.js'

const DEFAULT_REVIEW_TIMEOUT_MS = 300_000
const MAX_REVIEW_TIMEOUT_MS = 900_000

export function resolveReviewTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.YARDMASTER_REVIEW_TIMEOUT_MS?.trim()
  if (!raw) {
    return DEFAULT_REVIEW_TIMEOUT_MS
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_REVIEW_TIMEOUT_MS
  }
  return Math.min(Math.floor(parsed), MAX_REVIEW_TIMEOUT_MS)
}

export type ReviewAgentProgress = {
  agent: ReviewAgentId
  event: 'started' | 'settled'
  result?: ReviewProviderResult
}

export type ExecuteReviewCommandParams = {
  all: boolean
  agent?: ReviewAgentId
  diffFile?: string
  staged?: boolean
  base?: string
  config: YardmasterConfig
  onProgress?: (progress: ReviewAgentProgress) => void
  gitService?: GitService
}

const REVIEW_SYSTEM_PROMPT = `You are a code reviewer. Analyze the provided diff and identify issues.
Focus on: correctness risks, regressions, missing tests, and maintainability concerns.
Return findings ordered by severity with file and line references when possible.`

function buildReviewPrompt(diffText: string): string {
  return `Perform a code review of this unified diff:\n\n${diffText}`
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
  config: YardmasterConfig
  workspace: string
  reviewTimeoutMs: number
}): Promise<ReviewProviderResult> {
  const startedAt = Date.now()
  const provider = mapAgentToProvider(params.agent)
  try {
    const result = await runAcpCommand({
      systemPrompt: REVIEW_SYSTEM_PROMPT,
      userPrompt: params.prompt,
      provider,
      workspace: params.workspace,
      trustMode: 'default' as TrustMode,
      timeoutMs: params.reviewTimeoutMs,
      config: params.config,
      noFallback: true,
    })

    return {
      agent: params.agent,
      provider,
      model: null,
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
  const workspace = gitService.resolveWorkspace?.() ?? cwd
  const reviewTimeoutMs = resolveReviewTimeoutMs()

  const tasks = agents.map((agent) => {
    params.onProgress?.({ agent, event: 'started' })
    return runReviewForAgent({
      agent,
      prompt,
      config: params.config,
      workspace,
      reviewTimeoutMs,
    }).then((result) => {
      params.onProgress?.({ agent, event: 'settled', result })
      return result
    })
  })
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
    exitCode: succeeded > 0 ? 0 : 1,
  }
}
