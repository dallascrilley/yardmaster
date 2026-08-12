import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const yardmasterRoot = fileURLToPath(new URL('..', import.meta.url))
const yardmasterBin = join(yardmasterRoot, 'dist/bin/yardmaster.js')

function ensureDistBinary(): void {
   const build = spawnSync('bun', ['run', 'build'], {
      cwd: yardmasterRoot,
      encoding: 'utf8',
   })

   if (build.status === 0 && existsSync(yardmasterBin)) return

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
      const home = mkdtempSync(join(tmpdir(), 'yardmaster-dist-help-'))
      dirs.push(home)

      const result = spawnSync(process.execPath, [yardmasterBin, '--help'], {
         cwd: yardmasterRoot,
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
      const home = mkdtempSync(join(tmpdir(), 'yardmaster-dist-prov-'))
      dirs.push(home)

      const result = spawnSync(process.execPath, [yardmasterBin, 'providers', 'list', '--json'], {
         cwd: yardmasterRoot,
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
