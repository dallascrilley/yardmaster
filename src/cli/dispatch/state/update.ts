import { formatUpdateResult, previewUpdateCommand, runUpdateCommand } from '../../../update/command.js'
import { isInteractiveSession } from '../../../runtime/tty.js'
import { shouldUseJson, shouldWriteStatusOutput, writeCancellation, writeJson, writeLine, writeVerbose } from '../../output.js'
import { resolveMutationDecision } from '../../safety.js'
import { toCliJsonSuccessEnvelope } from '../../json.js'
import type { CliDispatchDeps } from '../../dispatch.js'
import type { ParsedCommand } from '../../types.js'

export async function handleUpdateCommand(
  parsed: Extract<ParsedCommand, { kind: 'update' }>,
  deps?: CliDispatchDeps,
): Promise<void> {
  const decision = await resolveMutationDecision({
    action: 'Updating the local yardmaster install',
    dryRun: parsed.safety.dryRun,
    force: parsed.safety.force,
    requiresConfirmation: true,
    interactive: isInteractiveSession(parsed.globals.noInput),
    confirm: deps?.confirm,
  })
  if (decision === 'cancelled') {
    writeCancellation(parsed.globals, 'update_result', 'Cancelled update.')
    return
  }

  const result = decision === 'dry-run' ? previewUpdateCommand() : runUpdateCommand()
  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('update_result', result))
  } else if (shouldWriteStatusOutput(parsed.globals)) {
    writeLine(formatUpdateResult(result))
  }
  writeVerbose(
    parsed.globals,
    `[yardmaster] command=update steps=${result.steps.map((step) => `${step.step}:${step.code}`).join(',')} packageRoot=${result.packageRoot}`,
  )
}
