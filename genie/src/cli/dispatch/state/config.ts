import {
  configGet,
  configInit,
  configPath,
  configSet,
  previewConfigInit,
  previewConfigSet,
} from '../../../config/commands.js'
import { isInteractiveSession } from '../../../runtime/tty.js'
import { shouldUseJson, shouldWriteStatusOutput, writeCancellation, writeConfigValue, writeJson, writeLine, writeVerbose } from '../../output.js'
import { resolveMutationDecision } from '../../safety.js'
import { toCliJsonSuccessEnvelope } from '../../json.js'
import type { CliDispatchDeps } from '../../dispatch.js'
import type { ParsedCommand } from '../../types.js'

export async function handleConfigGetCommand(parsed: Extract<ParsedCommand, { kind: 'config-get' }>): Promise<void> {
  const value = await configGet(parsed.key)
  if (shouldUseJson(parsed.globals)) {
    writeJson(
      toCliJsonSuccessEnvelope('config_value', {
        key: parsed.key ?? null,
        value,
      }),
    )
    return
  }
  writeConfigValue(value)
  writeVerbose(parsed.globals, `[genie] command=config-get key=${parsed.key ?? 'all'}`)
}

export async function handleConfigSetCommand(parsed: Extract<ParsedCommand, { kind: 'config-set' }>): Promise<void> {
  const updated = parsed.safety.dryRun
    ? await previewConfigSet(parsed.key, parsed.value)
    : await configSet(parsed.key, parsed.value)
  if (shouldUseJson(parsed.globals)) {
    writeJson(
      toCliJsonSuccessEnvelope('config_set', {
        key: parsed.key,
        config: updated,
        dryRun: parsed.safety.dryRun,
      }),
    )
    return
  }
  if (parsed.safety.dryRun) {
    writeLine(`Dry run: would set ${parsed.key}`)
  } else if (shouldWriteStatusOutput(parsed.globals)) {
    writeLine(`Set ${parsed.key}`)
  }
  writeVerbose(parsed.globals, `[genie] command=config-set key=${parsed.key} dryRun=${String(parsed.safety.dryRun)}`)
}

export async function handleConfigInitCommand(
  parsed: Extract<ParsedCommand, { kind: 'config-init' }>,
  deps?: CliDispatchDeps,
): Promise<void> {
  const preview = await previewConfigInit()
  const decision = await resolveMutationDecision({
    action: `Initializing user config at ${preview.path}`,
    dryRun: parsed.safety.dryRun,
    force: parsed.safety.force,
    requiresConfirmation: preview.exists,
    interactive: isInteractiveSession(parsed.globals.noInput),
    confirm: deps?.confirm,
  })
  if (decision === 'cancelled') {
    writeCancellation(parsed.globals, 'config_init', 'Cancelled config init.')
    return
  }

  const created = decision === 'dry-run' ? preview.config : await configInit()
  if (shouldUseJson(parsed.globals)) {
    writeJson(
      toCliJsonSuccessEnvelope('config_init', {
        config: created,
        path: preview.path,
        existed: preview.exists,
        dryRun: decision === 'dry-run',
      }),
    )
    return
  }
  if (decision === 'dry-run') {
    writeLine(`Dry run: would initialize user config at ${preview.path}`)
  } else if (shouldWriteStatusOutput(parsed.globals)) {
    writeLine('Initialized user config')
  }
  writeVerbose(parsed.globals, `[genie] command=config-init dryRun=${String(decision === 'dry-run')} existed=${String(preview.exists)}`)
}

export async function handleConfigPathCommand(parsed: Extract<ParsedCommand, { kind: 'config-path' }>): Promise<void> {
  const paths = configPath()
  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('config_path', { paths }))
    return
  }
  writeConfigValue(paths)
  writeVerbose(parsed.globals, '[genie] command=config-path')
}
