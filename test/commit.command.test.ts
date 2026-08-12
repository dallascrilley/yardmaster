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

  describe('agent notices glued to the header', () => {
    // Verbatim from codex-acp 0.16.0, which forwards Codex's model-metadata
    // warning as an `agent_message_chunk` with no trailing newline, so it lands
    // in the same line as the model's answer.
    const CODEX_NOTICE =
      'Model metadata for `google/gemini-3-flash-preview` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.'

    it('recovers the header from the tail of the first line', () => {
      expect(normalizeCommitMessage(`${CODEX_NOTICE}chore: add version.txt`)).toBe(
        'chore: add version.txt',
      )
    })

    it('recovers a scoped, breaking header', () => {
      expect(normalizeCommitMessage(`${CODEX_NOTICE}feat(cli)!: drop the legacy flag`)).toBe(
        'feat(cli)!: drop the legacy flag',
      )
    })

    it('does not invent a header from prose that has no known type', () => {
      expect(() => normalizeCommitMessage(`${CODEX_NOTICE}summary: it changed some files`)).toThrow(
        UsageError,
      )
    })

    it('takes the rightmost glued header, not the leftmost candidate', () => {
      expect(normalizeCommitMessage('I ran the test: results below.chore: add version.txt')).toBe(
        'chore: add version.txt',
      )
      expect(normalizeCommitMessage('Note the docs: see README.feat: add flag')).toBe(
        'feat: add flag',
      )
    })

    it('refuses a header that merely follows prose with a space', () => {
      expect(() =>
        normalizeCommitMessage('Cannot comply; here is a fix: delete everything'),
      ).toThrow(UsageError)
    })

    it('still rejects an explanatory preamble on its own line', () => {
      expect(() => normalizeCommitMessage('Here is your commit message:\n\nfix: parse it')).toThrow(
        UsageError,
      )
    })

    it('does not treat a type mentioned mid-sentence as a header', () => {
      expect(() => normalizeCommitMessage('I cannot generate a fix for this diff.')).toThrow(
        UsageError,
      )
    })
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
