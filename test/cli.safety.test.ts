import { describe, expect, it } from 'vitest'

import { UsageError } from '../src/errors.js'
import { resolveMutationDecision } from '../src/cli/safety.js'

describe('cli mutation safety', () => {
  it('returns dry-run immediately when requested', async () => {
    await expect(
      resolveMutationDecision({
        action: 'Updating yardmaster',
        dryRun: true,
        force: false,
        requiresConfirmation: true,
        interactive: false,
      }),
    ).resolves.toBe('dry-run')
  })

  it('requires --force for destructive non-interactive mutations', async () => {
    await expect(
      resolveMutationDecision({
        action: 'Deleting preset nightly',
        dryRun: false,
        force: false,
        requiresConfirmation: true,
        interactive: false,
      }),
    ).rejects.toThrow(UsageError)
  })

  it('uses the confirmation callback in interactive mode', async () => {
    const accepted = await resolveMutationDecision({
      action: 'Updating yardmaster',
      dryRun: false,
      force: false,
      requiresConfirmation: true,
      interactive: true,
      confirm: async () => true,
    })
    const cancelled = await resolveMutationDecision({
      action: 'Updating yardmaster',
      dryRun: false,
      force: false,
      requiresConfirmation: true,
      interactive: true,
      confirm: async () => false,
    })

    expect(accepted).toBe('proceed')
    expect(cancelled).toBe('cancelled')
  })
})
