import { describe, expect, it } from 'vitest'

import { isNormalizedPromptRequest } from '../src/execution/envelopes.js'

describe('execution envelopes', () => {
  it('isNormalizedPromptRequest returns false for non-objects without throwing', () => {
    expect(isNormalizedPromptRequest(null)).toBe(false)
    expect(isNormalizedPromptRequest(undefined)).toBe(false)
    expect(isNormalizedPromptRequest('prompt')).toBe(false)
  })

  it('returns false for invalid prompt request shapes', () => {
    expect(isNormalizedPromptRequest({})).toBe(false)
    expect(isNormalizedPromptRequest({ prompt: '' })).toBe(false)
  })
})
