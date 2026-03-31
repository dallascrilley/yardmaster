import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { checkProvider } from './support/provider-check.js'
import { resolveGeniePackageRoot } from './support/genie-root.js'
import { spawnWithTimeout } from './support/async-spawn.js'
import { resolvePiSmokeBackends, resolveSmokeProviders } from './support/smoke-providers.js'

const projectRoot = resolveGeniePackageRoot()
const bunResult = spawnSync('which', ['bun'], { encoding: 'utf8' })
const bunBinary = bunResult.status === 0 ? bunResult.stdout.trim() : 'bun'
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')

const providers = resolveSmokeProviders()
const piSmokeBackends = resolvePiSmokeBackends(providers)

function createStagedRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'genie-smoke-commit-'))
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'Smoke Test'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'smoke@test.local'], { cwd: dir, stdio: 'ignore' })

  writeFileSync(join(dir, 'README.md'), '# test\n', 'utf8')
  execFileSync('git', ['add', 'README.md'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' })

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
    it('generates a non-empty commit message', async (ctx) => {
      const status = await checkProvider(providerId)
      if (!status.available) {
        ctx.skip(true, `${providerId} unavailable: ${status.reason}`)
        return
      }

      const repoDir = createStagedRepo()
      tempDirs.push(repoDir)

      const result = await spawnWithTimeout(
        bunBinary,
        [sourceCliPath, 'commit', '--provider', providerId, '--workspace', repoDir],
        { cwd: repoDir, timeoutMs: 55_000 },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).trim()
      expect(output.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe.each(piSmokeBackends)('pi alias (GENIE_PI_BACKEND=%s)', (backend) => {
    it('generates a non-empty commit message', async (ctx) => {
      const status = await checkProvider(backend)
      if (!status.available) {
        ctx.skip(true, `${backend} unavailable for pi smoke: ${status.reason}`)
        return
      }

      const repoDir = createStagedRepo()
      tempDirs.push(repoDir)

      const result = await spawnWithTimeout(
        bunBinary,
        [sourceCliPath, 'commit', '--provider', 'pi', '--workspace', repoDir],
        { cwd: repoDir, timeoutMs: 55_000, env: { ...process.env, GENIE_PI_BACKEND: backend } },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).trim()
      expect(output.length).toBeGreaterThanOrEqual(5)
    })
  })
})

describe('smoke: run', () => {
  describe.each(providers)('provider: %s', (providerId) => {
    it('returns a response containing "hello"', async (ctx) => {
      const status = await checkProvider(providerId)
      if (!status.available) {
        ctx.skip(true, `${providerId} unavailable: ${status.reason}`)
        return
      }

      const result = await spawnWithTimeout(
        bunBinary,
        [sourceCliPath, 'run', 'Respond with exactly one word: hello', '--provider', providerId],
        { cwd: projectRoot, timeoutMs: 55_000 },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).toLowerCase()
      expect(output).toContain('hello')
    })
  })

  describe.each(piSmokeBackends)('pi alias (GENIE_PI_BACKEND=%s)', (backend) => {
    it('returns a response containing "hello"', async (ctx) => {
      const status = await checkProvider(backend)
      if (!status.available) {
        ctx.skip(true, `${backend} unavailable for pi smoke: ${status.reason}`)
        return
      }

      const result = await spawnWithTimeout(
        bunBinary,
        [sourceCliPath, 'run', 'Respond with exactly one word: hello', '--provider', 'pi'],
        { cwd: projectRoot, timeoutMs: 55_000, env: { ...process.env, GENIE_PI_BACKEND: backend } },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).toLowerCase()
      expect(output).toContain('hello')
    })
  })
})
