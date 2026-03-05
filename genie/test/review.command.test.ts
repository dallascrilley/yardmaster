import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { defaultConfig } from '../src/config/schema.js'
import { UsageError } from '../src/errors.js'
import {
  executeReviewCommand,
  formatReviewReport,
  parseUnifiedDiffStats,
  resolveReviewDiffSource,
  resolveReviewTargets,
} from '../src/review/command.js'

describe('review command', () => {
  it('validates target selection', () => {
    expect(() => resolveReviewTargets(true, 'codex')).toThrow('--all cannot be used with --agent')
    expect(() => resolveReviewTargets(false, undefined)).toThrow(
      'A review target is required. Use --all or --agent <codex|claude|gemini|cursor>.',
    )
    expect(resolveReviewTargets(true, undefined)).toEqual(['codex', 'claude', 'gemini', 'cursor'])
    expect(resolveReviewTargets(false, 'gemini')).toEqual(['gemini'])
  })

  it('parses unified diff stats', () => {
    const stats = parseUnifiedDiffStats([
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '+const a = 1',
      '-const a = 0',
      'diff --git a/b.ts b/b.ts',
      '--- a/b.ts',
      '+++ b/b.ts',
      '+const b = 2',
    ].join('\n'))

    expect(stats).toEqual({
      files: 2,
      additions: 2,
      deletions: 1,
    })
  })

  it('executes all-agent review from a diff file and preserves agent ordering', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'genie-review-'))
    const diffFile = join(tempDir, 'change.diff')
    writeFileSync(
      diffFile,
      ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const value = 1', '-const value = 0'].join('\n'),
      'utf8',
    )

    const seenProviders: string[] = []
    const seenTimeouts: number[] = []
    try {
      const result = await executeReviewCommand({
        all: true,
        diffFile,
        config: defaultConfig,
        requestRunner: async ({ input }) => {
          seenProviders.push(String(input.provider))
          seenTimeouts.push(Number(input.timeoutMs))
          if (input.provider === 'gemini') {
            throw new Error('gemini unavailable')
          }
          return {
            response: `${input.provider} review`,
          }
        },
      })

      expect(result.agents).toEqual(['codex', 'claude', 'gemini', 'cursor'])
      expect(seenProviders).toEqual(['codex', 'claude', 'gemini', 'cursor-agent'])
      expect(seenTimeouts).toEqual([120000, 120000, 120000, 120000])
      expect(result.summary).toEqual({ total: 4, succeeded: 3, failed: 1 })
      expect(result.exitCode).toBe(1)
      expect(result.results[2]).toMatchObject({
        agent: 'gemini',
        status: 'error',
      })
      expect(formatReviewReport(result)).toContain('summary: success=3/4 failed=1')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('fails on empty diff file', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'genie-review-empty-'))
    const diffFile = join(tempDir, 'empty.diff')
    writeFileSync(diffFile, ' \n', 'utf8')

    try {
      await expect(
        executeReviewCommand({
          all: false,
          agent: 'codex',
          diffFile,
          config: defaultConfig,
          requestRunner: async () => ({ response: 'unused' }),
        }),
      ).rejects.toBeInstanceOf(UsageError)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('falls back to committed branch diff when git diff HEAD is empty', () => {
    const calls: string[] = []
    const result = resolveReviewDiffSource({
      gitRead: (args) => {
        calls.push(args.join(' '))
        const cmd = args.join(' ')
        if (cmd === 'diff --no-color HEAD') return ''
        if (cmd === 'symbolic-ref --short refs/remotes/origin/HEAD') return 'origin/main\n'
        if (cmd === 'merge-base HEAD origin/main') return 'abc123\n'
        if (cmd === 'diff --no-color abc123...HEAD') {
          return ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const x = 1'].join('\n')
        }
        return ''
      },
    })

    expect(result.source).toBe('git diff origin/main...HEAD')
    expect(result.text).toContain('diff --git')
    expect(calls[0]).toBe('diff --no-color HEAD')
  })

  it('prefers local dirty/staged diff before branch diff', () => {
    const calls: string[] = []
    const result = resolveReviewDiffSource({
      gitRead: (args) => {
        calls.push(args.join(' '))
        if (args.join(' ') === 'diff --no-color HEAD') {
          return ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const x = 2'].join('\n')
        }
        return ''
      },
    })

    expect(result.source).toBe('git diff HEAD')
    expect(result.text).toContain('diff --git')
    expect(calls).toEqual(['diff --no-color HEAD'])
  })
})
