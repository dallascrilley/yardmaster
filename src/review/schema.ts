import { reviewAgentIds } from './select.js'
import type {
  ReviewExecutionResult,
  ReviewJsonEnvelope,
  ReviewJsonSchema,
} from './contracts.js'

export function toReviewJsonEnvelope(result: ReviewExecutionResult): ReviewJsonEnvelope {
  return {
    kind: 'review_result',
    version: 1,
    ok: result.exitCode === 0,
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
    error: null,
  }
}

export function getReviewJsonSchema(): ReviewJsonSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://github.com/dallascrilley/yardmaster/schemas/review-result-v1.json',
    title: 'Yardmaster Review Result',
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
