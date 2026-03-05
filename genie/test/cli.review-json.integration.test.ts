import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('cli review json integration', () => {
  it('emits the stable review_result envelope from spawned CLI execution', () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'genie-home-'))
    const tempDiff = join(tempHome, 'change.diff')
    writeFileSync(
      tempDiff,
      ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '+const value = 1', '-const value = 0'].join('\n'),
      'utf8',
    )

    try {
      const result = spawnSync(
        process.execPath,
        ['src/bin/genie.ts', 'review', '--agent', 'codex', '--diff-file', tempDiff, '--json'],
        {
          cwd: new URL('..', import.meta.url).pathname,
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: tempHome,
          },
        },
      )

      expect(result.status === 0 || result.status === 1).toBe(true)
      expect(result.stderr).toBe('')

      const parsed = JSON.parse(result.stdout)
      expect(parsed).toMatchObject({
        kind: 'review_result',
        version: 1,
        mode: 'single',
        targets: ['codex'],
        source: `file:${tempDiff}`,
      })
      expect(Object.keys(parsed)).toEqual([
        'kind',
        'version',
        'mode',
        'targets',
        'source',
        'cwd',
        'git',
        'diff',
        'summary',
        'results',
        'exitCode',
      ])
      expect(Array.isArray(parsed.results)).toBe(true)
      expect(parsed.results.length).toBe(1)
      expect(typeof parsed.exitCode).toBe('number')
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })
})
