import { describe, expect, it } from 'vitest'

import { UsageError } from '../src/errors.js'
import { buildDebugPrompt, emptyDebugInputMessage, normalizeDebugInput } from '../src/debug/command.js'

describe('debug command helpers', () => {
  it('rejects blank debug input after trimming', () => {
    expect(() => normalizeDebugInput('  \n\t  ')).toThrowError(new UsageError(emptyDebugInputMessage))
  })

  it('preserves the meaningful debug content for prompt construction', () => {
    const input = normalizeDebugInput('\nTypeError: fetch failed\n')
    expect(input).toBe('TypeError: fetch failed')

    const prompt = buildDebugPrompt(input)
    expect(prompt).toContain('Analyze this terminal output and identify the root cause')
    expect(prompt).toContain('TypeError: fetch failed')
    expect(prompt).toContain('```text')
  })
})
