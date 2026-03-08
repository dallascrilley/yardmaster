import { describe, expect, it } from 'vitest'

import { buildDesignPrompt } from '../src/design/command.js'

describe('design command helpers', () => {
  it('builds a frontend design review prompt with stable sections', () => {
    const prompt = buildDesignPrompt('Review the hero section layout and CTA hierarchy')

    expect(prompt).toContain('You are a senior frontend design reviewer.')
    expect(prompt).toContain('1. Overall direction')
    expect(prompt).toContain('4. Recommended improvements')
    expect(prompt).toContain('Review the hero section layout and CTA hierarchy')
  })
})
