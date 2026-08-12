import { createInterface } from 'node:readline/promises'

import { UsageError } from '../errors.js'

export type MutationDecision = 'proceed' | 'dry-run' | 'cancelled'

export async function promptForConfirmation(prompt: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  })

  try {
    const answer = await rl.question(prompt)
    return ['y', 'yes'].includes(answer.trim().toLowerCase())
  } finally {
    rl.close()
  }
}

export async function resolveMutationDecision(params: {
  action: string
  dryRun: boolean
  force: boolean
  requiresConfirmation: boolean
  interactive: boolean
  confirm?: (prompt: string) => Promise<boolean>
}): Promise<MutationDecision> {
  if (params.dryRun) {
    return 'dry-run'
  }

  if (!params.requiresConfirmation || params.force) {
    return 'proceed'
  }

  if (!params.interactive) {
    throw new UsageError(`${params.action} requires confirmation. Re-run with --force or use --dry-run to preview the change.`)
  }

  const confirm = params.confirm ?? promptForConfirmation
  const accepted = await confirm(`${params.action}. Continue? [y/N] `)
  return accepted ? 'proceed' : 'cancelled'
}
