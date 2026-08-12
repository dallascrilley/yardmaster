import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { runFromArgv } from '../src/cli.js'
import { configInit } from '../src/config/commands.js'
import { setPreset } from '../src/presets/commands.js'

describe('cli mutation safety integration', () => {
  const homes: string[] = []
  const cwd = fileURLToPath(new URL('..', import.meta.url))

  afterEach(() => {
    for (const home of homes) {
      rmSync(home, { recursive: true, force: true })
    }
    homes.length = 0
  })

  it('fails destructive update in non-interactive mode without --force', () => {
    const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'update', '--no-input'], {
      cwd,
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('requires confirmation')
    expect(result.stderr).toContain('--force')
  })

  it('supports update dry-run json output without executing build/link', () => {
    const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'update', '--dry-run', '--json'], {
      cwd,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    const parsed = JSON.parse(result.stdout)
    expect(parsed.kind).toBe('update_result')
    expect(parsed.dryRun).toBe(true)
    expect(parsed.steps.map((step: { step: string }) => step.step)).toEqual(['build', 'link'])
  })

  it('fails preset deletion in non-interactive mode without --force and preserves the preset', () => {
    const home = join(tmpdir(), `yardmaster-presets-${randomUUID()}`)
    mkdirSync(home, { recursive: true })
    homes.push(home)

    const env = {
      ...process.env,
      HOME: home,
    }

    const create = spawnSync(
      'bun',
      ['src/bin/yardmaster.ts', 'presets', 'set', 'nightly', '--provider', 'codex', '--force'],
      {
        cwd,
        encoding: 'utf8',
        env,
      },
    )
    expect(create.status).toBe(0)

    const deleteAttempt = spawnSync('bun', ['src/bin/yardmaster.ts', 'presets', 'delete', 'nightly', '--no-input'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    expect(deleteAttempt.status).toBe(2)
    expect(deleteAttempt.stderr).toContain('requires confirmation')

    const inspect = spawnSync('bun', ['src/bin/yardmaster.ts', 'presets', 'get', 'nightly', '--json'], {
      cwd,
      encoding: 'utf8',
      env,
    })
    expect(inspect.status).toBe(0)
    expect(JSON.parse(inspect.stdout).preset.provider).toBe('codex')
  })

  it('emits shared json envelopes for cancelled mutation flows', async () => {
    const home = join(tmpdir(), `yardmaster-cancelled-${randomUUID()}`)
    mkdirSync(home, { recursive: true })
    homes.push(home)
    const originalHome = process.env.HOME
    process.env.HOME = home

    await configInit()
    await setPreset('nightly', { provider: 'codex' }, { setDefault: true })

    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []
    const originalStdoutWrite = process.stdout.write.bind(process.stdout)
    const originalStderrWrite = process.stderr.write.bind(process.stderr)
    const originalStdoutTty = process.stdout.isTTY
    const originalStdinTty = process.stdin.isTTY
    const originalCi = process.env.CI

    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(String(chunk))
      return true
    }) as typeof process.stdout.write
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk))
      return true
    }) as typeof process.stderr.write
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
    delete process.env.CI

    try {
      await runFromArgv(['config', 'init', '--json'], { confirm: async () => false })
      await runFromArgv(['presets', 'delete', 'nightly', '--json'], { confirm: async () => false })
    } finally {
      process.stdout.write = originalStdoutWrite
      process.stderr.write = originalStderrWrite
      Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutTty, configurable: true })
      Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinTty, configurable: true })
      if (originalCi === undefined) {
        delete process.env.CI
      } else {
        process.env.CI = originalCi
      }
      process.env.HOME = originalHome
    }

    expect(stderrChunks.join('')).toBe('')
    const payloads = stdoutChunks.join('').trim().split(/\n(?=\{)/)
    expect(payloads).toHaveLength(2)
    expect(JSON.parse(payloads[0] ?? '')).toMatchObject({
      kind: 'config_init',
      ok: true,
      exitCode: 0,
      error: null,
      cancelled: true,
    })
    expect(JSON.parse(payloads[1] ?? '')).toMatchObject({
      kind: 'presets_delete',
      ok: true,
      exitCode: 0,
      error: null,
      cancelled: true,
    })
  })
})
