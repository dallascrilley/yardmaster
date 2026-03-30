import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { checkProvider } from './support/provider-check.js'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const bunBinary = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim() || 'bun'
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')

const providers = ['claude', 'codex', 'gemini', 'cursor-agent'] as const

function createStagedRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'genie-smoke-commit-'))
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'Smoke Test'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'smoke@test.local'], { cwd: dir, stdio: 'ignore' })

  // Create initial commit so HEAD exists
  writeFileSync(join(dir, 'README.md'), '# test\n', 'utf8')
  execFileSync('git', ['add', 'README.md'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' })

  // Stage a one-line change
  writeFileSync(join(dir, 'version.txt'), 'version = 2\n', 'utf8')
  execFileSync('git', ['add', 'version.txt'], { cwd: dir, stdio: 'ignore' })

  return dir
}

describe('smoke: commit', () => {
  const tempDirs: string[] = []

  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  describe.each(providers)('provider: %s', (providerId) => {
    it('generates a non-empty commit message', ({ skip }) => {
      const status = checkProvider(providerId)
      if (!status.available) {
        skip(`${providerId} unavailable: ${status.reason}`)
        return
      }

      const repoDir = createStagedRepo()
      tempDirs.push(repoDir)

      const result = spawnSync(
        bunBinary,
        [sourceCliPath, 'commit', '--provider', providerId, '--workspace', repoDir],
        {
          encoding: 'utf8',
          timeout: 55_000,
          env: { ...process.env },
          cwd: repoDir,
        },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).trim()
      expect(output.length).toBeGreaterThanOrEqual(5)
    })
  })
})
