import { type ProviderFailureReason } from './types.js'

export class AggregatedProviderError extends Error {
  constructor(public readonly reasons: ProviderFailureReason[]) {
    const lines = reasons.map((r) => `${r.provider} (${r.stage}): ${r.reason}`).join('\n')
    super(`No provider succeeded.\n${lines}`)
    this.name = 'AggregatedProviderError'
  }
}
