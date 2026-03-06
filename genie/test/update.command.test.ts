import { describe, expect, it } from 'vitest'

import { RuntimeProviderError } from '../src/errors.js'
import { formatUpdateResult, previewUpdateCommand, resolveCliPackageRoot, runUpdateCommand } from '../src/update/command.js'

describe('update command', () => {
  it('runs build and link in order', () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = []
    const result = runUpdateCommand({
      packageRoot: '/tmp/genie',
      runCommand: (command, args, cwd) => {
        calls.push({ command, args, cwd })
        return { code: 0, stderr: '' }
      },
    })

    expect(result.ok).toBe(true)
    expect(calls).toEqual([
      {
        command: 'bun',
        args: ['run', 'build'],
        cwd: '/tmp/genie',
      },
      {
        command: 'bun',
        args: ['link'],
        cwd: '/tmp/genie',
      },
    ])
  })

  it('throws when build fails', () => {
    expect(() =>
      runUpdateCommand({
        packageRoot: '/tmp/genie',
        runCommand: () => ({ code: 1, stderr: 'build failed' }),
      }),
    ).toThrow(RuntimeProviderError)
  })

  it('formats success output', () => {
    const formatted = formatUpdateResult({
      ok: true,
      packageRoot: '/tmp/genie',
      steps: [
        { step: 'build', ok: true, code: 0, stderr: '' },
        { step: 'link', ok: true, code: 0, stderr: '' },
      ],
    })
    expect(formatted).toContain('updated: true')
    expect(formatted).toContain('- build: ok')
    expect(formatted).toContain('- link: ok')
  })

  it('formats dry-run output without invoking commands', () => {
    const preview = previewUpdateCommand({ packageRoot: '/tmp/genie' })
    const formatted = formatUpdateResult(preview)

    expect(preview.dryRun).toBe(true)
    expect(formatted).toContain('dryRun: true')
    expect(formatted).toContain('- build')
    expect(formatted).toContain('- link')
  })

  it('resolves package root from src and dist module locations', () => {
    const fromSrc = resolveCliPackageRoot('file:///tmp/genie/src/update/command.ts')
    const fromDist = resolveCliPackageRoot('file:///tmp/genie/dist/update/command.js')
    expect(fromSrc).toBe('/tmp/genie')
    expect(fromDist).toBe('/tmp/genie')
  })
})
