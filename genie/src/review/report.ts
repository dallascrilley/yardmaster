import type {
  ReviewDiffStats,
  ReviewExecutionResult,
} from './contracts.js'
import type { ReviewAgentId } from './select.js'

export function parseUnifiedDiffStats(diffText: string): ReviewDiffStats {
  const lines = diffText.split('\n')
  let files = 0
  let additions = 0
  let deletions = 0

  for (const line of lines) {
    if (line.startsWith('--- ')) {
      files += 1
      continue
    }
    if (line.startsWith('+++ ')) {
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

export function mapAgentToProvider(agent: ReviewAgentId): 'cursor-agent' | Exclude<ReviewAgentId, 'cursor'> {
  if (agent === 'cursor') {
    return 'cursor-agent'
  }
  return agent
}
