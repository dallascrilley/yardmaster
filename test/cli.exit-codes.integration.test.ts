import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
   ACP_AUTH_ERROR_CODE,
   AcpProtocolError,
   AggregatedProviderError,
   AuthConfigurationError,
   TimeoutError,
   UsageError,
   getExitCode,
} from '../src/errors.js'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

describe('cli exit codes', () => {

   it('maps error classes to explicit exit codes', () => {
      expect(getExitCode(new UsageError('bad args'))).toBe(2)
      expect(getExitCode(new AuthConfigurationError('auth'))).toBe(3)
      expect(getExitCode(new TimeoutError('timeout'))).toBe(124)

      const authAggregate = new AggregatedProviderError([
         {
            provider: 'codex',
            stage: 'auth',
            reason: 'login required',
            authFailure: true,
         },
      ])
      expect(getExitCode(authAggregate)).toBe(3)

      const timeoutAggregate = new AggregatedProviderError([
         {
            provider: 'codex',
            stage: 'execution',
            reason: 'timed out',
            timeout: true,
         },
      ])
      expect(getExitCode(timeoutAggregate)).toBe(124)
      expect(getExitCode(new AcpProtocolError(ACP_AUTH_ERROR_CODE, 'auth required', 'claude'))).toBe(3)
   })




   it('returns exit code 2 for parse errors in spawned cli', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', '--unknown'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stderr).toContain("Unknown option '--unknown'")
      expect(result.stderr).toContain('Next steps:')
   })

   it('emits a shared json error envelope for parse errors when --json is requested', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', '--json', '--unknown'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stderr).toBe('')
      const parsed = JSON.parse(result.stdout)
      expect(parsed).toMatchObject({
         kind: 'error',
         version: 1,
         ok: false,
         exitCode: 2,
         error: {
            code: '2',
         },
      })
      expect(parsed.error.message).toContain("Unknown option '--unknown'")
      expect(parsed.error.message).toContain('Next steps:')
      expect(parsed.error.message).toContain('Run `yardmaster help` for usage.')
   })

   it('does not treat positional --json after -- as json mode for top-level errors', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'run', '--provider', 'nope', '--', '--json'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain("Unknown provider 'nope' for --provider")
   })

   it('supports explicit help command and rejects invalid help topic', () => {
      const helpResult = spawnSync('bun', ['src/bin/yardmaster.ts', 'help', 'run'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })
      expect(helpResult.status).toBe(0)
      expect(helpResult.stdout).toContain('Usage: yardmaster run [options] <prompt>')
      expect(helpResult.stderr).toBe('')

      const badHelpResult = spawnSync('bun', ['src/bin/yardmaster.ts', 'help', 'gleep'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })
      expect(badHelpResult.status).toBe(2)
      expect(badHelpResult.stderr).toContain("Unknown help topic 'gleep'")
   })

   it('returns exit code 2 for invalid mode values before execution', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'run', '--mode', 'invalidmode', 'hello'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stderr).toContain("Unknown mode 'invalidmode' for --mode")
   })

   it('returns exit code 2 for missing design prompt before execution', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'design'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stderr).toContain('Prompt is required')
      expect(result.stderr).toContain('Run `yardmaster help run`')
   })

   it('returns exit code 2 for invalid update arguments', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'update', '--nope'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stderr).toContain("Unknown update argument '--nope'")
   })

   it('returns exit code 2 when review target flags are invalid', () => {
      const conflict = spawnSync('bun', ['src/bin/yardmaster.ts', 'review', '--all', '--agent', 'codex'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })
      expect(conflict.status).toBe(2)
      expect(conflict.stderr).toContain('--all cannot be used with --agent')

      const missingTarget = spawnSync('bun', ['src/bin/yardmaster.ts', 'review'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })
      expect(missingTarget.status).toBe(2)
      expect(missingTarget.stderr).toContain('A review target is required')

      const stagedDiffFileConflict = spawnSync(
         'bun',
         ['src/bin/yardmaster.ts', 'review', '--all', '--staged', '--diff-file', 'x.diff'],
         {
            cwd: projectRoot,
            encoding: 'utf8',
         },
      )
      expect(stagedDiffFileConflict.status).toBe(2)
      expect(stagedDiffFileConflict.stderr).toContain('--staged cannot be used with --diff-file')

      const baseStagedConflict = spawnSync('bun', ['src/bin/yardmaster.ts', 'review', '--all', '--base', 'main', '--staged'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })
      expect(baseStagedConflict.status).toBe(2)
      expect(baseStagedConflict.stderr).toContain('--base cannot be used with --staged')

      const schemaConflict = spawnSync('bun', ['src/bin/yardmaster.ts', 'review', '--json-schema', '--all'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })
      expect(schemaConflict.status).toBe(2)
      expect(schemaConflict.stderr).toContain('--json-schema cannot be combined with review target or diff-source flags')
   })

   it('returns exit code 2 for unknown root token by default', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'gleep'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stderr).toContain("Unknown command 'gleep'. Use 'yardmaster help' for usage.")
      expect(result.stderr).toContain('Run `yardmaster help` to see the available commands.')
   })

   it('returns exit code 2 for unknown root token with leading global flags by default', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', '--json', 'gleep'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stderr).toBe('')
      const parsed = JSON.parse(result.stdout)
      expect(parsed).toMatchObject({
         kind: 'error',
         version: 1,
         ok: false,
         exitCode: 2,
         error: {
            code: '2',
         },
      })
      expect(parsed.error.message).toContain("Unknown command 'gleep'. Use 'yardmaster help' for usage.")
      expect(parsed.error.message).toContain('Next steps:')
      expect(parsed.error.message).toContain('Run `yardmaster help` to see the available commands.')
   })

   it('returns exit code 2 for mistyped multi-token root commands by default', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'reviw', 'all', '--help'], {
         cwd: projectRoot,
         encoding: 'utf8',
      })

      expect(result.status).toBe(2)
      expect(result.stderr).toContain("Unknown command 'reviw'. Use 'yardmaster help' for usage.")
      expect(result.stderr).toContain('Run `yardmaster help` to see the available commands.')
   })

   it('allows legacy single-token shorthand when strict mode is disabled explicitly', () => {
      const result = spawnSync('bun', ['src/bin/yardmaster.ts', 'gleep', '--help'], {
         cwd: projectRoot,
         encoding: 'utf8',
         env: {
            ...process.env,
            YARDMASTER_STRICT_COMMANDS: '0',
         },
      })

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('Usage: yardmaster run [options] <prompt>')
   })

})
