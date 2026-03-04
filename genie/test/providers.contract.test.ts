import { describe, expect, it } from 'vitest'

import { codexAdapter } from '../src/providers/codex.js'
import { type CommandResult } from '../src/types.js'

describe('provider contract checks', () => {
  it('does not false-fail codex auth when auth status command is unsupported', async () => {
    const check = await codexAdapter.isAuthenticated(async () => {
      return {
        code: 1,
        stdout: '',
        stderr: 'Unknown command: auth status',
      } satisfies CommandResult
    })

    expect(check.ok).toBe(true)
  })
})
