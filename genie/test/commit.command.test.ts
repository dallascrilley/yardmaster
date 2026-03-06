import { describe, expect, it } from 'vitest'

import { buildCommitPrompt, normalizeCommitMessage } from '../src/commit/command.js'
import { UsageError } from '../src/errors.js'

describe('commit command helpers', () => {
  it('builds a prompt that enforces conventional commits', () => {
    const prompt = buildCommitPrompt('diff --git a/file.ts b/file.ts\n+console.log("hi")\n')
    expect(prompt).toContain('Conventional Commits')
    expect(prompt).toContain('Return only the commit message')
    expect(prompt).toContain('diff --git a/file.ts b/file.ts')
  })

  it('strips markdown fences and validates non-empty messages', () => {
    expect(normalizeCommitMessage('```text\nfeat(cli): add command\n```')).toBe('feat(cli): add command')
    expect(normalizeCommitMessage('  fix: tighten parser  \n')).toBe('fix: tighten parser')
    expect(() => normalizeCommitMessage('```text\n\n```')).toThrow(UsageError)
  })
})
