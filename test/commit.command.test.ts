import { describe, expect, it } from 'vitest'

import {
  applyCommitMessage,
  buildCommitPrompt,
  COMMIT_SYSTEM_PROMPT,
  normalizeCommitMessage,
  summarizeRawMessage,
} from '../src/commit/command.js'
import { UsageError } from '../src/errors.js'

/**
 * Verbatim from codex-acp 0.16.0, which forwards Codex's model-metadata warning
 * as an `agent_message_chunk` with no trailing newline, so it lands in the same
 * line as the model's answer.
 */
const CODEX_NOTICE =
  'Model metadata for `google/gemini-3-flash-preview` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.'

describe('commit command helpers', () => {
  it('builds a prompt that enforces conventional commits', () => {
    expect(COMMIT_SYSTEM_PROMPT).toContain('Conventional Commits syntax')
    expect(COMMIT_SYSTEM_PROMPT).toContain('Your entire reply is the commit message and nothing else')
    expect(COMMIT_SYSTEM_PROMPT).toContain('never a list of alternatives')
    expect(buildCommitPrompt()).toContain('Generate a Conventional Commits message for the staged changes.')
  })

  describe('buildCommitPrompt', () => {
    it('inlines the staged diff so the agent does not have to fetch it', () => {
      const diff = 'diff --git a/version.txt b/version.txt\n+version = 2\n'
      const prompt = buildCommitPrompt(diff)

      expect(prompt).toContain('Staged diff:')
      expect(prompt).toContain('+version = 2')
      expect(prompt).not.toContain("Run 'git diff --staged'")
    })

    it('falls back to asking the agent when no diff is supplied', () => {
      expect(buildCommitPrompt()).toContain("Run 'git diff --staged'")
      expect(buildCommitPrompt('   ')).toContain("Run 'git diff --staged'")
    })

    it('truncates an oversized diff and says so', () => {
      const diff = `${'x'.repeat(30_000)}\n`
      const prompt = buildCommitPrompt(diff)

      expect(prompt).toContain('too large to include in full')
      expect(prompt).toContain("Run 'git diff --staged' if you need the rest")
      expect(prompt.length).toBeLessThan(diff.length)
    })

    // Truncation must not make a staged file invisible, or the message can
    // describe only the part of the commit that survived the cut.
    it('names every changed file when the diff is truncated', () => {
      const filler = 'x'.repeat(25_000)
      const diff = [
        'diff --git a/first.txt b/first.txt',
        '--- a/first.txt',
        '+++ b/first.txt',
        `+${filler}`,
        'diff --git a/second/deep.ts b/second/deep.ts',
        '--- a/second/deep.ts',
        '+++ b/second/deep.ts',
        '+export const x = 1',
      ].join('\n')

      const prompt = buildCommitPrompt(diff)

      expect(prompt).toContain('Every file in this commit:')
      expect(prompt).toContain('- first.txt')
      expect(prompt).toContain('- second/deep.ts')
    })

    it('does not trim the diff, so a trailing-whitespace change survives', () => {
      const diff = 'diff --git a/a.txt b/a.txt\n-value\n+value   \n'

      expect(buildCommitPrompt(diff)).toContain('+value   ')
    })
  })

  it('strips markdown fences and validates non-empty messages', () => {
    expect(normalizeCommitMessage('```text\nfeat(cli): add command\n```')).toBe('feat(cli): add command')
    expect(normalizeCommitMessage('  fix: tighten parser  \n')).toBe('fix: tighten parser')
    expect(() => normalizeCommitMessage('```text\n\n```')).toThrow(UsageError)
    expect(normalizeCommitMessage('feat(cli): add command\n\nbody text that should not be passed to git -m')).toBe(
      'feat(cli): add command',
    )
  })

  describe('agent notices glued to the header', () => {
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

    it('does not treat a type mentioned mid-sentence as a header', () => {
      expect(() => normalizeCommitMessage('I cannot generate a fix for this diff.')).toThrow(
        UsageError,
      )
    })

    // Observed live against gemini-3-flash-preview through codex-acp: the model
    // narrates the tool call it is about to make, and that narration is glued
    // in front of the answer the same way the metadata warning is.
    it('recovers the header from a narration chunk glued in front', () => {
      const raw =
        `${CODEX_NOTICE}I'll start by checking the staged changes with \`git diff --staged\` ` +
        'to generate a precise commit message.chore: add version.txt with initial version 2'

      expect(normalizeCommitMessage(raw)).toBe('chore: add version.txt with initial version 2')
    })
  })

  describe('preambles and fences on their own lines', () => {
    it('skips an announcement line that introduces the message', () => {
      expect(normalizeCommitMessage('Here is your commit message:\nfeat: add parser')).toBe(
        'feat: add parser',
      )
      expect(normalizeCommitMessage('Here is the commit message:\n\nfix: parse it')).toBe(
        'fix: parse it',
      )
    })

    it('takes a fenced block that follows an announcement', () => {
      expect(
        normalizeCommitMessage('Here is the commit message:\n\n```\nchore: bump version\n```'),
      ).toBe('chore: bump version')
    })

    it('takes a fenced block that follows a glued notice', () => {
      expect(normalizeCommitMessage(`${CODEX_NOTICE}\`\`\`\nfix: tighten parser\n\`\`\``)).toBe(
        'fix: tighten parser',
      )
    })

    it('still rejects an explanation that is not an announcement', () => {
      expect(() =>
        normalizeCommitMessage('I could not read the staged diff.\nfix: something'),
      ).toThrow(UsageError)
    })

    it('refuses to choose from a list of alternatives', () => {
      expect(() =>
        normalizeCommitMessage('Here are two options:\n1. feat: add parser\n2. fix: add parser'),
      ).toThrow(UsageError)
    })

    it('gives up rather than scanning arbitrarily far for a header', () => {
      const preamble = ['a:', 'b:', 'c:', 'd:'].join('\n')
      expect(() => normalizeCommitMessage(`${preamble}\nfeat: buried too deep`)).toThrow(UsageError)
    })

    it('unwraps a fence that has no newline after the opening backticks', () => {
      expect(normalizeCommitMessage('```feat: add x```')).toBe('feat: add x')
      expect(normalizeCommitMessage('```fix(cli): tighten it```')).toBe('fix(cli): tighten it')
    })

    it('keeps a header that stands on its own over a fence appearing later', () => {
      const raw = 'chore: bump version\n\nFor reference:\n\n```\ngit diff --staged\n```'

      expect(normalizeCommitMessage(raw)).toBe('chore: bump version')
    })

    it('skips a fenced block that holds something other than the message', () => {
      const raw = 'I ran:\n\n```sh\ngit diff --staged\n```\n\nCommit message:\n\n```\nfeat: add parser\n```'

      expect(normalizeCommitMessage(raw)).toBe('feat: add parser')
    })

    it('reports an empty fence as a rejection with the raw response', () => {
      expect(() => normalizeCommitMessage('```text\n\n```')).toThrow(/Raw response: /)
    })
  })

  describe('rejection diagnostics', () => {
    it('includes the raw response in the error so CI logs are actionable', () => {
      expect(() => normalizeCommitMessage('I refuse to do that.')).toThrow(
        /Raw response: I refuse to do that\./,
      )
    })

    it('flattens newlines and control characters to one line', () => {
      expect(summarizeRawMessage('one\ntwo\r\n\tthree')).toBe('one two three')
    })

    it('truncates a long response and reports the original length', () => {
      const summary = summarizeRawMessage('y'.repeat(500))

      expect(summary).toContain('truncated, 500 chars')
      expect(summary.length).toBeLessThan(260)
    })

    it('names an empty response rather than rendering nothing', () => {
      expect(summarizeRawMessage('   \n  ')).toBe('(empty)')
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
