import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const genieRoot = fileURLToPath(new URL('..', import.meta.url))
const genieBin = join(genieRoot, 'dist/bin/genie.js')

function ensureDistBinary(): void {
   const build = spawnSync('bun', ['run', 'build'], {
      cwd: genieRoot,
      encoding: 'utf8',
   })

   if (build.status === 0 && existsSync(genieBin)) return

   throw new Error(build.stderr || build.stdout || 'Failed to build dist binary')
}

describe('linked dist binary integration', () => {
   const dirs: string[] = []

   beforeAll(() => {
      ensureDistBinary()
   })

   afterEach(() => {
      for (const d of dirs) {
         rmSync(d, { recursive: true, force: true })
      }
      dirs.length = 0
   })

   it('prints root help from compiled dist with isolated HOME', () => {
      const home = mkdtempSync(join(tmpdir(), 'genie-dist-help-'))
      dirs.push(home)

      const result = spawnSync(process.execPath, [genieBin, '--help'], {
         cwd: genieRoot,
         encoding: 'utf8',
         env: { ...process.env, HOME: home },
      })

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain(
         'Unified AI CLI for prompt execution, terminal debugging, diff review, and provider-aware automation.',
      )
   })

   it('emits providers list JSON from compiled dist with isolated HOME', () => {
      const home = mkdtempSync(join(tmpdir(), 'genie-dist-prov-'))
      dirs.push(home)

      const result = spawnSync(process.execPath, [genieBin, 'providers', 'list', '--json'], {
         cwd: genieRoot,
         encoding: 'utf8',
         env: { ...process.env, HOME: home },
      })

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      const parsed = JSON.parse(result.stdout)
      expect(parsed).toMatchObject({
         kind: 'providers_list',
         ok: true,
      })
   })
})
