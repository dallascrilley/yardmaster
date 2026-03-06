import { chmodSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'

import { afterEach, describe, expect, it } from 'vitest'

function createTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeMockClaudeBinary(binDir: string): void {
  const script = [
    '#!/bin/sh',
    'if [ "$1" = "--version" ]; then',
    '  echo "claude 1.0.0"',
    '  exit 0',
    'fi',
    'if [ "$1" = "auth" ] && [ "$2" = "status" ]; then',
    '  echo "authenticated"',
    '  exit 0',
    'fi',
    "echo '```text'",
    "echo 'feat(cli): add generated commit command'",
    "echo '```'",
    '',
  ].join('\n')

  const path = join(binDir, 'claude')
  writeFileSync(path, script, 'utf8')
  chmodSync(path, 0o755)
}

function initGitRepo(repoDir: string): void {
  execFileSync('git', ['init'], { cwd: repoDir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'Genie Test'], { cwd: repoDir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'genie@example.com'], { cwd: repoDir, stdio: 'ignore' })
}

function stageFile(repoDir: string, relativePath: string, contents: string): void {
  const path = join(repoDir, relativePath)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, contents, 'utf8')
  execFileSync('git', ['add', relativePath], { cwd: repoDir, stdio: 'ignore' })
}

describe('cli commit integration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('fails with exit code 1 when no files are staged', () => {
    const repoDir = createTempDir('genie-commit-repo')
    const binDir = createTempDir('genie-commit-bin')
    const homeDir = createTempDir('genie-commit-home')
    tempDirs.push(repoDir, binDir, homeDir)
    initGitRepo(repoDir)
    writeMockClaudeBinary(binDir)

    const cliPath = new URL('../src/bin/genie.ts', import.meta.url).pathname
    const result = spawnSync('bun', [cliPath, 'commit', '--provider', 'claude', '--no-fallback'], {
      cwd: repoDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No staged changes found')
    expect(result.stdout).toBe('')
  })

  it('prints a cleaned conventional commit message without committing by default', () => {
    const repoDir = createTempDir('genie-commit-repo')
    const binDir = createTempDir('genie-commit-bin')
    const homeDir = createTempDir('genie-commit-home')
    tempDirs.push(repoDir, binDir, homeDir)
    initGitRepo(repoDir)
    writeMockClaudeBinary(binDir)
    stageFile(repoDir, 'src/example.ts', 'export const value = 1\n')

    const cliPath = new URL('../src/bin/genie.ts', import.meta.url).pathname
    const result = spawnSync('bun', [cliPath, 'commit', '--provider', 'claude', '--no-fallback'], {
      cwd: repoDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('feat(cli): add generated commit command')
    expect(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: repoDir, encoding: 'utf8' }).trim()).toBe(
      'src/example.ts',
    )
    expect(execFileSync('git', ['rev-list', '--count', '--all'], { cwd: repoDir, encoding: 'utf8' }).trim()).toBe('0')
  })

  it('creates a git commit when --apply is provided', () => {
    const repoDir = createTempDir('genie-commit-repo')
    const binDir = createTempDir('genie-commit-bin')
    const homeDir = createTempDir('genie-commit-home')
    tempDirs.push(repoDir, binDir, homeDir)
    initGitRepo(repoDir)
    writeMockClaudeBinary(binDir)
    stageFile(repoDir, 'src/example.ts', 'export const value = 2\n')
    const cliPath = new URL('../src/bin/genie.ts', import.meta.url).pathname

    const result = spawnSync(
      'bun',
      [cliPath, 'commit', '--apply', '--provider', 'claude', '--no-fallback'],
      {
        cwd: repoDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: homeDir,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('feat(cli): add generated commit command')
    expect(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: repoDir, encoding: 'utf8' }).trim()).toBe(
      'feat(cli): add generated commit command',
    )
    expect(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: repoDir, encoding: 'utf8' }).trim()).toBe('')
    expect(readFileSync(join(repoDir, 'src/example.ts'), 'utf8')).toContain('value = 2')
  })
})
