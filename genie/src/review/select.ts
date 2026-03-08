import { UsageError } from '../errors.js'

export const reviewAgentIds = ['codex', 'claude', 'gemini', 'cursor'] as const
export type ReviewAgentId = (typeof reviewAgentIds)[number]

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
