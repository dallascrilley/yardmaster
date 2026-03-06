import { describe, expect, it } from 'vitest'

import { applyCommitMessage, buildCommitPrompt, normalizeCommitMessage } from '../src/commit/command.js'
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
    expect(() => normalizeCommitMessage('Here is your commit message:\nfeat: add parser')).toThrow(UsageError)
    expect(normalizeCommitMessage('feat(cli): add command\n\nbody text that should not be passed to git -m')).toBe(
      'feat(cli): add command',
    )
  })

  it('surfaces git stderr when applying a generated commit fails', () => {
    const gitExec = (): never => {
      const error = new Error('Command failed')
      ;(error as Error & { stderr?: string }).stderr = 'pre-commit hook failed'
      throw error
    }

    expect(() => applyCommitMessage('feat: add command', gitExec)).toThrow('pre-commit hook failed')
  })
})
