import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { checkProvider } from './support/provider-check.js'
import { piSmokeBackends } from './support/pi-smoke.js'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const bunResult = spawnSync('which', ['bun'], { encoding: 'utf8' })
const bunBinary = bunResult.status === 0 ? bunResult.stdout.trim() : 'bun'
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')

const providers = ['claude', 'codex', 'gemini', 'cursor-agent'] as const

describe('smoke: run', () => {
  describe.each(providers)('provider: %s', (providerId) => {
    it('returns a response containing "hello"', (ctx) => {
      const status = checkProvider(providerId)
      if (!status.available) {
        ctx.skip(true, `${providerId} unavailable: ${status.reason}`)
        return
      }

      const result = spawnSync(
        bunBinary,
        [sourceCliPath, 'run', 'Respond with exactly one word: hello', '--provider', providerId],
        {
          encoding: 'utf8',
          timeout: 55_000,
          cwd: projectRoot,
        },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).toLowerCase()
      expect(output).toContain('hello')
    })
  })

  describe.each(piSmokeBackends)('pi alias (GENIE_PI_BACKEND=%s)', (backend) => {
    it('returns a response containing "hello"', (ctx) => {
      const status = checkProvider(backend)
      if (!status.available) {
        ctx.skip(true, `${backend} unavailable for pi smoke: ${status.reason}`)
        return
      }

      const result = spawnSync(
        bunBinary,
        [sourceCliPath, 'run', 'Respond with exactly one word: hello', '--provider', 'pi'],
        {
          encoding: 'utf8',
          timeout: 55_000,
          cwd: projectRoot,
          env: { ...process.env, GENIE_PI_BACKEND: backend },
        },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).toLowerCase()
      expect(output).toContain('hello')
    })
  })
})
