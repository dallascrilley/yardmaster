import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultConfig } from '../src/config/schema.js'
import { UsageError } from '../src/errors.js'
import { runAcpCommand } from '../src/acp/command-runner.js'
import {
  executeReviewCommand,
  formatReviewReport,
  parseUnifiedDiffStats,
  resolveReviewDiffSource,
  resolveReviewTargets,
  getReviewJsonSchema,
  resolveReviewTimeoutMs,
  toReviewJsonEnvelope,
  type ReviewExecutionResult,
} from '../src/review/command.js'
import type { GitService } from '../src/review/git-service.js'

vi.mock('../src/acp/command-runner.js', () => ({
  runAcpCommand: vi.fn(),
}))

describe('review command', () => {
  beforeEach(() => {
    delete process.env.YARDMASTER_REVIEW_TIMEOUT_MS
    vi.clearAllMocks()
  })

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

  it('counts rename-only git diffs as files even without --- headers', () => {
    const stats = parseUnifiedDiffStats([
      'diff --git a/old.ts b/new.ts',
      'similarity index 100%',
      'rename from old.ts',
      'rename to new.ts',
    ].join('\n'))

    expect(stats).toEqual({
      files: 1,
      additions: 0,
      deletions: 0,
    })
  })

  it('counts binary git diffs as files even when no --- headers are present', () => {
    const stats = parseUnifiedDiffStats([
      'diff --git a/logo.png b/logo.png',
      'new file mode 100644',
      'index 0000000..1234567',
      'Binary files /dev/null and b/logo.png differ',
    ].join('\n'))

    expect(stats).toEqual({
      files: 1,
      additions: 0,
      deletions: 0,
    })
  })

  it('counts empty file additions as files even when there are no content hunks', () => {
    const stats = parseUnifiedDiffStats([
      'diff --git a/empty.ts b/empty.ts',
      'new file mode 100644',
      'index 0000000..e69de29',
      '--- /dev/null',
      '+++ b/empty.ts',
    ].join('\n'))

    expect(stats).toEqual({
      files: 1,
      additions: 0,
      deletions: 0,
    })
  })

  it('does not treat deleted content lines that begin with -- as file headers', () => {
    const stats = parseUnifiedDiffStats([
      '--- a/file.sql',
      '+++ b/file.sql',
      '--- comment removed from sql',
    ].join('\n'))

    expect(stats).toEqual({
      files: 1,
      additions: 0,
      deletions: 1,
    })
  })

  it('executes all-agent review from a diff file and preserves agent ordering', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'yardmaster-review-'))
    const diffFile = join(tempDir, 'change.diff')
    writeFileSync(
      diffFile,
      ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const value = 1', '-const value = 0'].join('\n'),
      'utf8',
    )

    const seenProviders: string[] = []
    const seenTimeouts: number[] = []
    const seenWorkspaces: string[] = []
    vi.mocked(runAcpCommand).mockImplementation(async (input) => {
      seenProviders.push(String(input.provider))
      seenTimeouts.push(Number(input.timeoutMs))
      seenWorkspaces.push(String(input.workspace))
      if (input.provider === 'gemini') {
        throw new Error('gemini unavailable')
      }
      return {
        provider: String(input.provider ?? 'unknown'),
        response: `${input.provider} review`,
        fallbackUsed: false,
        stopReason: 'end_turn',
      }
    })
    try {
      const result = await executeReviewCommand({
        all: true,
        diffFile,
        config: defaultConfig,
      })

      expect(result.agents).toEqual(['codex', 'claude', 'gemini', 'cursor'])
      expect(seenProviders).toEqual(['codex', 'claude', 'gemini', 'cursor-agent'])
      expect(seenTimeouts).toEqual([300000, 300000, 300000, 300000])
      expect(seenWorkspaces).toHaveLength(4)
      expect(new Set(seenWorkspaces).size).toBe(1)
      expect(result.cwd.length).toBeGreaterThan(0)
      expect(result.summary).toEqual({ total: 4, succeeded: 3, failed: 1 })
      expect(result.exitCode).toBe(0)
      expect(result.results[2]).toMatchObject({
        agent: 'gemini',
        status: 'error',
      })
      expect(result.results[0]?.responseChars).toBeGreaterThan(0)
      expect(formatReviewReport(result)).toContain('summary: success=3/4 failed=1')
      expect(formatReviewReport(result)).toContain('provider=codex')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('supports injecting a GitService for isolated review execution tests', async () => {
    vi.mocked(runAcpCommand).mockResolvedValue({
      provider: 'codex',
      response: 'ok',
      fallbackUsed: false,
      stopReason: 'end_turn',
    })
    const gitService: GitService = {
      read: () => '',
      resolveContext: () => ({ branch: 'test-branch', head: 'abc1234' }),
      resolveWorkspace: () => '/tmp/yardmaster-review-workspace',
      resolveDiffSource: () => ({
        source: 'git diff HEAD',
        text: ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const isolated = true'].join('\n'),
      }),
    }

    const result = await executeReviewCommand({
      all: false,
      agent: 'codex',
      config: defaultConfig,
      gitService,
    })

    expect(result.source).toBe('git diff HEAD')
    expect(result.git).toEqual({ branch: 'test-branch', head: 'abc1234' })
    expect(result.results[0]).toMatchObject({
      provider: 'codex',
      status: 'ok',
    })
    expect(result.summary).toEqual({ total: 1, succeeded: 1, failed: 0 })
  })

  it('uses git workspace root for branch reviews and diff-file reviews when available', async () => {
    const seenWorkspaces: string[] = []
    vi.mocked(runAcpCommand).mockImplementation(async (input) => {
      seenWorkspaces.push(String(input.workspace))
      return {
        provider: String(input.provider ?? 'codex'),
        response: 'ok',
        fallbackUsed: false,
        stopReason: 'end_turn',
      }
    })
    const gitService: GitService = {
      read: () => '',
      resolveContext: () => ({ branch: 'workspace-test', head: 'abc1234' }),
      resolveWorkspace: () => '/repo/root',
      resolveDiffSource: () => ({
        source: 'git diff HEAD',
        text: ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const isolated = true'].join('\n'),
      }),
    }

    const tempDir = mkdtempSync(join(tmpdir(), 'yardmaster-review-workspace-'))
    const diffFile = join(tempDir, 'manual.diff')
    writeFileSync(diffFile, ['diff --git a/b.ts b/b.ts', '--- a/b.ts', '+++ b/b.ts', '+const y = 1'].join('\n'), 'utf8')

    try {
      await executeReviewCommand({
        all: false,
        agent: 'codex',
        config: defaultConfig,
        gitService,
      })

      await executeReviewCommand({
        all: false,
        agent: 'codex',
        diffFile,
        config: defaultConfig,
        gitService,
      })
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }

    expect(seenWorkspaces[0]).toBe('/repo/root')
    expect(seenWorkspaces[1]).toBe('/repo/root')
  })

  it('fails on empty diff file', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'yardmaster-review-empty-'))
    const diffFile = join(tempDir, 'empty.diff')
    writeFileSync(diffFile, ' \n', 'utf8')

    try {
      await expect(
        executeReviewCommand({
          all: false,
          agent: 'codex',
          diffFile,
          config: defaultConfig,
        }),
      ).rejects.toBeInstanceOf(UsageError)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('bypasses GitService diff resolution when --diff-file is provided', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'yardmaster-review-diff-file-'))
    const diffFile = join(tempDir, 'manual.diff')
    writeFileSync(diffFile, ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const x = 1'].join('\n'), 'utf8')

    const gitService: GitService = {
      read: () => '',
      resolveContext: () => ({ branch: null, head: null }),
      resolveDiffSource: () => {
        throw new Error('should not be called for --diff-file')
      },
    }

    try {
      const result = resolveReviewDiffSource({
        diffFile,
        gitService,
      })
      expect(result.source).toBe(`file:${diffFile}`)
      expect(result.text).toContain('diff --git')
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
        if (cmd === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return ''
        if (cmd === 'merge-base HEAD main') return 'abc123\n'
        if (cmd === 'diff --no-color abc123...HEAD') {
          return ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const x = 1'].join('\n')
        }
        return ''
      },
    })

    expect(result.source).toBe('git diff main...HEAD')
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

  it('supports repositories with unborn HEAD by using cached/working diff fallback', () => {
    const result = resolveReviewDiffSource({
      gitRead: (args) => {
        const cmd = args.join(' ')
        if (cmd === 'diff --no-color HEAD') {
          throw new Error("fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.")
        }
        if (cmd === 'diff --no-color --cached') {
          return ['diff --git a/new.ts b/new.ts', '--- /dev/null', '+++ b/new.ts', '+export {}'].join('\n')
        }
        if (cmd === 'diff --no-color') {
          return ''
        }
        return ''
      },
    })

    expect(result.source).toBe('git diff --cached + git diff')
    expect(result.text).toContain('diff --git')
  })

  it('uses staged-only diff source when --staged is selected', () => {
    const calls: string[] = []
    const result = resolveReviewDiffSource({
      staged: true,
      gitRead: (args) => {
        const cmd = args.join(' ')
        calls.push(cmd)
        if (cmd === 'diff --no-color --cached') {
          return ['diff --git a/staged.ts b/staged.ts', '--- a/staged.ts', '+++ b/staged.ts', '+const s = 1'].join('\n')
        }
        return ''
      },
    })

    expect(result.source).toBe('git diff --cached')
    expect(result.text).toContain('diff --git')
    expect(calls).toEqual(['diff --no-color --cached'])
  })

  it('uses explicit merge-base ref when --base is provided', () => {
    const calls: string[] = []
    const result = resolveReviewDiffSource({
      base: 'origin/main',
      gitRead: (args) => {
        const cmd = args.join(' ')
        calls.push(cmd)
        if (cmd === 'merge-base HEAD origin/main') return 'abc123\n'
        if (cmd === 'diff --no-color abc123...HEAD') {
          return ['diff --git a/base.ts b/base.ts', '--- a/base.ts', '+++ b/base.ts', '+const base = 1'].join('\n')
        }
        return ''
      },
    })

    expect(result.source).toBe('git diff origin/main...HEAD')
    expect(result.text).toContain('diff --git')
    expect(calls).toEqual(['merge-base HEAD origin/main', 'diff --no-color abc123...HEAD'])
  })

  it('surfaces actionable diagnostics when --base merge-base fails', () => {
    expect(() =>
      resolveReviewDiffSource({
        base: 'origin/main',
        gitRead: () => {
          throw new Error('fatal: no merge base')
        },
      }),
    ).toThrow("Failed to resolve --base 'origin/main'")
  })

  it('tries later base candidates when an earlier merge-base check fails', () => {
    const calls: string[] = []
    const result = resolveReviewDiffSource({
      gitRead: (args) => {
        const cmd = args.join(' ')
        calls.push(cmd)
        if (cmd === 'diff --no-color HEAD') return ''
        if (cmd === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return ''
        if (cmd.startsWith('rev-parse --verify --quiet')) return 'abc123\n'
        if (cmd.startsWith('symbolic-ref --short refs/remotes/origin/HEAD')) return ''
        if (cmd === 'merge-base HEAD main') throw new Error('fatal: no merge base')
        if (cmd === 'merge-base HEAD master') return 'ff11aa\n'
        if (cmd === 'diff --no-color ff11aa...HEAD') {
          return ['diff --git a/app.ts b/app.ts', '--- a/app.ts', '+++ b/app.ts', '+const v = 3'].join('\n')
        }
        return ''
      },
    })

    expect(result.source).toBe('git diff master...HEAD')
    expect(calls).toContain('merge-base HEAD main')
    expect(calls).toContain('merge-base HEAD master')
  })

  it('surfaces actionable git diagnostics when base candidates all fail', () => {
    expect(() =>
      resolveReviewDiffSource({
        gitRead: (args) => {
          const cmd = args.join(' ')
          if (cmd === 'diff --no-color HEAD') return ''
          if (cmd === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return ''
          if (cmd.startsWith('rev-parse --verify --quiet')) return 'abc123\n'
          if (cmd.startsWith('symbolic-ref --short refs/remotes/origin/HEAD')) return ''
          throw new Error(`fatal: failed ${cmd}`)
        },
      }),
    ).toThrow('Failed to resolve base branch diff candidates:')
  })

  it('surfaces actionable error when all base ref candidates fail verification', () => {
    expect(() =>
      resolveReviewDiffSource({
        gitRead: (args) => {
          const cmd = args.join(' ')
          if (cmd === 'diff --no-color HEAD') return ''
          if (cmd === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return ''
          if (cmd.startsWith('symbolic-ref --short refs/remotes/origin/HEAD')) return ''
          if (cmd.startsWith('rev-parse --verify --quiet')) throw new Error('fatal: not a valid ref')
          return ''
        },
      }),
    ).toThrow('No base branch candidates found')
  })

  it('builds stable review json envelope for machine consumers', () => {
    const execution: ReviewExecutionResult = {
      mode: 'all',
      agents: ['codex', 'claude'],
      source: 'git diff main...HEAD',
      cwd: '/tmp/yardmaster',
      git: {
        branch: 'feature/review-json',
        head: 'abc1234',
      },
      diff: {
        files: 1,
        additions: 2,
        deletions: 1,
      },
      results: [
        {
          agent: 'codex',
          provider: 'codex',
          model: 'gpt-5',
          status: 'ok',
          latencyMs: 101,
          responseChars: 11,
          review: 'Looks good.',
        },
        {
          agent: 'claude',
          provider: 'claude',
          model: null,
          status: 'error',
          latencyMs: 88,
          responseChars: 14,
          review: 'command failed',
        },
      ],
      summary: {
        total: 2,
        succeeded: 1,
        failed: 1,
      },
      exitCode: 0,
    }

    expect(toReviewJsonEnvelope(execution)).toEqual({
      kind: 'review_result',
      version: 1,
      ok: true,
      mode: 'all',
      targets: ['codex', 'claude'],
      source: 'git diff main...HEAD',
      cwd: '/tmp/yardmaster',
      git: {
        branch: 'feature/review-json',
        head: 'abc1234',
      },
      diff: {
        files: 1,
        additions: 2,
        deletions: 1,
      },
      summary: {
        total: 2,
        succeeded: 1,
        failed: 1,
      },
      results: [
        {
          agent: 'codex',
          provider: 'codex',
          model: 'gpt-5',
          status: 'ok',
          latencyMs: 101,
          responseChars: 11,
          review: 'Looks good.',
        },
        {
          agent: 'claude',
          provider: 'claude',
          model: null,
          status: 'error',
          latencyMs: 88,
          responseChars: 14,
          review: 'command failed',
        },
      ],
      exitCode: 0,
      error: null,
    })
  })

  it('exposes a stable json schema for review envelope consumers', () => {
    const schema = getReviewJsonSchema()
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.title).toBe('Yardmaster Review Result')
    expect(schema.type).toBe('object')
    expect((schema.properties as Record<string, unknown>).kind).toEqual({ const: 'review_result' })
  })
})

describe('resolveReviewTimeoutMs', () => {
  it('defaults to five minutes when unset', () => {
    expect(resolveReviewTimeoutMs({})).toBe(300_000)
  })

  it('honors YARDMASTER_REVIEW_TIMEOUT_MS', () => {
    expect(resolveReviewTimeoutMs({ YARDMASTER_REVIEW_TIMEOUT_MS: '60000' })).toBe(60_000)
  })

  it('caps at nine minutes', () => {
    expect(resolveReviewTimeoutMs({ YARDMASTER_REVIEW_TIMEOUT_MS: '99999999' })).toBe(900_000)
  })

  it('ignores non-numeric values', () => {
    expect(resolveReviewTimeoutMs({ YARDMASTER_REVIEW_TIMEOUT_MS: 'nope' })).toBe(300_000)
  })
})
