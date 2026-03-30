import { describe, expect, it } from 'vitest'

import { buildDesignPrompt, DESIGN_SYSTEM_PROMPT } from '../src/design/command.js'

describe('design command helpers', () => {
  it('builds a frontend design review prompt with stable sections', () => {
    const prompt = buildDesignPrompt('Review the hero section layout and CTA hierarchy')

    expect(DESIGN_SYSTEM_PROMPT).toContain('You are a senior frontend design reviewer.')
    expect(DESIGN_SYSTEM_PROMPT).toContain('1. Overall direction')
    expect(DESIGN_SYSTEM_PROMPT).toContain('4. Recommended improvements')
    expect(prompt).toBe('Design request: Review the hero section layout and CTA hierarchy')
  })
})
