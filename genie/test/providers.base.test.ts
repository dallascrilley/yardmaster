import { describe, expect, it } from 'vitest'

import { runCommand } from '../src/providers/base.js'

describe('providers/base runCommand', () => {
  it('returns timeout result for long-running commands without hanging the caller', async () => {
    const started = Date.now()

    const timedOut = await runCommand({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      timeoutMs: 100,
    })

    const elapsed = Date.now() - started
    expect(timedOut.code).toBe(124)
    expect(timedOut.stderr).toContain('Timed out after 100ms')
    expect(elapsed).toBeLessThan(3_000)

    const followup = await runCommand({
      command: process.execPath,
      args: ['-e', "process.stdout.write('ok')"],
      timeoutMs: 1_000,
    })

    expect(followup.code).toBe(0)
    expect(followup.stdout).toBe('ok')
  })
})
