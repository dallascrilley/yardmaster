import { isInteractiveSession } from '../../../runtime/tty.js'
import { deletePreset, getPreset, listPresets, previewDeletePreset, previewSetPreset, previewUsePreset, setPreset, usePreset } from '../../../presets/commands.js'
import { shouldUseJson, shouldWriteStatusOutput, writeCancellation, writeConfigValue, writeJson, writeLine, writeVerbose } from '../../output.js'
import { resolveMutationDecision } from '../../safety.js'
import { toCliJsonSuccessEnvelope } from '../../json.js'
import type { CliDispatchDeps } from '../../dispatch.js'
import type { ParsedCommand } from '../../types.js'

export async function handlePresetsListCommand(parsed: Extract<ParsedCommand, { kind: 'presets-list' }>): Promise<void> {
  const value = await listPresets()
  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('presets_list', value))
    return
  }
  writeConfigValue(value)
  writeVerbose(parsed.globals, `[genie] command=presets-list count=${Object.keys(value.named).length}`)
}

export async function handlePresetsGetCommand(parsed: Extract<ParsedCommand, { kind: 'presets-get' }>): Promise<void> {
  const value = await getPreset(parsed.name)
  if (shouldUseJson(parsed.globals)) {
    writeJson(
      toCliJsonSuccessEnvelope('presets_get', {
        name: parsed.name,
        preset: value,
      }),
    )
    return
  }
  writeConfigValue(value)
  writeVerbose(parsed.globals, `[genie] command=presets-get name=${parsed.name}`)
}

export async function handlePresetsSetCommand(
  parsed: Extract<ParsedCommand, { kind: 'presets-set' }>,
  deps?: CliDispatchDeps,
): Promise<void> {
  const preview = await previewSetPreset(
    parsed.options.name,
    {
      provider: parsed.options.provider,
      model: parsed.options.model,
      mode: parsed.options.mode,
      trust: parsed.options.trust,
      yolo: parsed.options.yolo,
      outputFormat: parsed.options.outputFormat,
      includeDirectories: parsed.options.includeDirectories,
      headless: parsed.options.headless,
      extensions: parsed.options.extensions,
      mcp: parsed.options.mcp,
    },
    {
      setDefault: parsed.options.setDefault,
    },
  )
  const decision = await resolveMutationDecision({
    action: `Overwriting preset '${parsed.options.name}'`,
    dryRun: parsed.safety.dryRun,
    force: parsed.safety.force,
    requiresConfirmation: preview.replaced,
    interactive: isInteractiveSession(parsed.globals.noInput),
    confirm: deps?.confirm,
  })
  if (decision === 'cancelled') {
    writeCancellation(parsed.globals, 'presets_set', `Cancelled preset update for ${parsed.options.name}.`)
    return
  }

  const result = decision === 'dry-run'
    ? preview
    : await setPreset(
        parsed.options.name,
        {
          provider: parsed.options.provider,
          model: parsed.options.model,
          mode: parsed.options.mode,
          trust: parsed.options.trust,
          yolo: parsed.options.yolo,
          outputFormat: parsed.options.outputFormat,
          includeDirectories: parsed.options.includeDirectories,
          headless: parsed.options.headless,
          extensions: parsed.options.extensions,
          mcp: parsed.options.mcp,
        },
        {
          setDefault: parsed.options.setDefault,
        },
      )
  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('presets_set', { ...result, dryRun: decision === 'dry-run' }))
    return
  }
  if (decision === 'dry-run' || shouldWriteStatusOutput(parsed.globals)) {
    if (decision === 'dry-run') {
      writeLine(`Dry run: would ${preview.replaced ? 'update' : 'create'} preset ${result.name}`)
    }
    writeConfigValue(result)
  }
  writeVerbose(parsed.globals, `[genie] command=presets-set name=${result.name} dryRun=${String(decision === 'dry-run')} replaced=${String(result.replaced)}`)
}

export async function handlePresetsDeleteCommand(
  parsed: Extract<ParsedCommand, { kind: 'presets-delete' }>,
  deps?: CliDispatchDeps,
): Promise<void> {
  const decision = await resolveMutationDecision({
    action: `Deleting preset '${parsed.name}'`,
    dryRun: parsed.safety.dryRun,
    force: parsed.safety.force,
    requiresConfirmation: true,
    interactive: isInteractiveSession(parsed.globals.noInput),
    confirm: deps?.confirm,
  })
  if (decision === 'cancelled') {
    writeCancellation(parsed.globals, 'presets_delete', `Cancelled preset deletion for ${parsed.name}.`)
    return
  }

  const result = decision === 'dry-run' ? await previewDeletePreset(parsed.name) : await deletePreset(parsed.name)
  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('presets_delete', { ...result, dryRun: decision === 'dry-run' }))
    return
  }
  if (decision === 'dry-run' || shouldWriteStatusOutput(parsed.globals)) {
    if (decision === 'dry-run') {
      writeLine(`Dry run: would delete preset ${parsed.name}`)
    }
    writeConfigValue(result)
  }
  writeVerbose(parsed.globals, `[genie] command=presets-delete name=${result.deleted} dryRun=${String(decision === 'dry-run')}`)
}

export async function handlePresetsUseCommand(parsed: Extract<ParsedCommand, { kind: 'presets-use' }>): Promise<void> {
  const result = parsed.safety.dryRun ? await previewUsePreset(parsed.name) : await usePreset(parsed.name)
  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('presets_use', { ...result, dryRun: parsed.safety.dryRun }))
    return
  }
  if (parsed.safety.dryRun || shouldWriteStatusOutput(parsed.globals)) {
    if (parsed.safety.dryRun) {
      writeLine(`Dry run: would make preset ${parsed.name} the default`)
    }
    writeConfigValue(result)
  }
  writeVerbose(parsed.globals, `[genie] command=presets-use default=${result.default} dryRun=${String(parsed.safety.dryRun)}`)
}
