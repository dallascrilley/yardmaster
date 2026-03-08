import { type ProviderId } from '../types.js'
import type { ReviewAgentId } from './command.js'

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
  ok: boolean
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
  results: ReviewProviderResult[]
  exitCode: 0 | 1
  error: null
}

export type ReviewJsonSchema = Record<string, unknown>
