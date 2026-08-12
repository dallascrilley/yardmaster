import { describe, expect, it } from 'vitest'

import { applyCommitMessage, buildCommitPrompt, COMMIT_SYSTEM_PROMPT, normalizeCommitMessage } from '../src/commit/command.js'
import { UsageError } from '../src/errors.js'

describe('commit command helpers', () => {
  it('builds a prompt that enforces conventional commits', () => {
    const prompt = buildCommitPrompt()
    expect(COMMIT_SYSTEM_PROMPT).toContain('Conventional Commits syntax')
    expect(COMMIT_SYSTEM_PROMPT).toContain('Return ONLY the commit message')
    expect(COMMIT_SYSTEM_PROMPT).toContain("Run 'git diff --staged' to see the changes")
    expect(prompt).toBe('Generate a Conventional Commits message for the staged changes.')
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
