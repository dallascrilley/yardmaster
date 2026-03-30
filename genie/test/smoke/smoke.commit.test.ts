import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { checkProvider } from './support/provider-check.js'
import { piSmokeBackends } from './support/pi-smoke.js'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const bunResult = spawnSync('which', ['bun'], { encoding: 'utf8' })
const bunBinary = bunResult.status === 0 ? bunResult.stdout.trim() : 'bun'
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
    it('generates a non-empty commit message', (ctx) => {
      const status = checkProvider(providerId)
      if (!status.available) {
        ctx.skip(true, `${providerId} unavailable: ${status.reason}`)
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
          cwd: repoDir,
        },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).trim()
      expect(output.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe.each(piSmokeBackends)('pi alias (GENIE_PI_BACKEND=%s)', (backend) => {
    it('generates a non-empty commit message', (ctx) => {
      const status = checkProvider(backend)
      if (!status.available) {
        ctx.skip(true, `${backend} unavailable for pi smoke: ${status.reason}`)
        return
      }

      const repoDir = createStagedRepo()
      tempDirs.push(repoDir)

      const result = spawnSync(
        bunBinary,
        [sourceCliPath, 'commit', '--provider', 'pi', '--workspace', repoDir],
        {
          encoding: 'utf8',
          timeout: 55_000,
          cwd: repoDir,
          env: { ...process.env, GENIE_PI_BACKEND: backend },
        },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).trim()
      expect(output.length).toBeGreaterThanOrEqual(5)
    })
  })
})
