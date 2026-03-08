import { UsageError } from '../../errors.js'
import { loadConfig } from '../../config/store.js'
import { type CliOutputMode } from '../../types.js'
import { resolveWorkspacePath } from '../../runtime/workspace.js'
import { resolveRuntimeState } from '../../runtime/tty.js'
import { buildDebugPrompt, readDebugInput } from '../../debug/command.js'
import { buildDesignPrompt } from '../../design/command.js'
import {
  applyCommitMessage,
  buildCommitPrompt,
  createGitExec,
  createGitRead,
  normalizeCommitMessage,
  readStagedDiff,
} from '../../commit/command.js'
import {
  runRequest,
  toResponseEnvelope,
  type RunRequestInput,
} from '../../execution/run-request.js'
import { toCliJsonSuccessEnvelope } from '../json.js'
import {
  shouldUseJson,
  writeJson,
  writeLine,
  writeVerbose,
} from '../output.js'
import type { ParsedCommand } from '../types.js'
import { mergeRunOptionsWithPreset, resolveRunPrompt } from './shared.js'

export async function handleRunCommand(parsed: Extract<ParsedCommand, { kind: 'run' }>): Promise<void> {
  const explicitOutput: CliOutputMode | undefined = parsed.globals.json
    ? 'json'
    : parsed.globals.plain
      ? 'plain'
      : undefined

  const config = await loadConfig({
    flags: {
      output: explicitOutput,
    },
  })

  const presetName = parsed.options.preset ?? config.presets.default
  const preset = presetName ? config.presets.named[presetName] : undefined
  if (presetName && !preset) {
    throw new UsageError(`Unknown preset '${presetName}'`)
  }
  const effectiveOptions = mergeRunOptionsWithPreset(parsed.options, preset)

  const workspace = resolveWorkspacePath(effectiveOptions.workspace, config.workspace.last)
  const runtime = resolveRuntimeState({
    configOutput: config.output.default,
    explicitOutput,
    explicitFormat: explicitOutput,
    forceNonInteractive: parsed.globals.noInput,
    disableColor: parsed.globals.noColor,
  })

  const request: RunRequestInput = {
    prompt: resolveRunPrompt(parsed.prompt, effectiveOptions.promptFile),
    provider: effectiveOptions.provider,
    model: effectiveOptions.model,
    workspace,
    mode: effectiveOptions.mode,
    trust: effectiveOptions.trust,
    output: runtime.outputMode,
    timeoutMs: effectiveOptions.timeoutMs,
    noFallback: effectiveOptions.noFallback,
    yolo: effectiveOptions.yolo,
    includeDirectories: effectiveOptions.includeDirectories,
    outputFormat: effectiveOptions.outputFormat,
    headless: effectiveOptions.headless,
    extensions: effectiveOptions.extensions,
    mcp: effectiveOptions.mcp,
  }

  const result = await runRequest({
    input: request,
    config,
  })

  const envelope = toCliJsonSuccessEnvelope('run_result', toResponseEnvelope(result))
  if (runtime.ttyAwareMode === 'json') {
    writeJson(envelope)
  } else {
    writeLine(result.response)
  }

  writeVerbose(
    parsed.globals,
    `[genie] command=run provider=${result.provider} fallback=${String(result.fallbackUsed)} totalMs=${result.timings.totalMs}`,
  )
}

export async function handleDesignCommand(parsed: Extract<ParsedCommand, { kind: 'design' }>): Promise<void> {
  const config = await loadConfig()
  const presetName = parsed.options.preset ?? config.presets.default
  const preset = presetName ? config.presets.named[presetName] : undefined
  if (presetName && !preset) {
    throw new UsageError(`Unknown preset '${presetName}'`)
  }

  const effectiveOptions = mergeRunOptionsWithPreset(parsed.options, preset)
  const workspace = resolveWorkspacePath(effectiveOptions.workspace, config.workspace.last)
  const result = await runRequest({
    input: {
      prompt: buildDesignPrompt(resolveRunPrompt(parsed.prompt, effectiveOptions.promptFile)),
      provider: effectiveOptions.provider,
      model: effectiveOptions.model,
      workspace,
      mode: effectiveOptions.mode,
      trust: effectiveOptions.trust,
      output: 'plain',
      timeoutMs: effectiveOptions.timeoutMs,
      noFallback: effectiveOptions.noFallback,
      yolo: effectiveOptions.yolo,
      outputFormat: 'text',
      headless: true,
    },
    config,
    persistLastUsed: false,
  })

  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('design_result', toResponseEnvelope(result)))
  } else {
    writeLine(result.response)
  }
  writeVerbose(
    parsed.globals,
    `[genie] command=design provider=${result.provider} fallback=${String(result.fallbackUsed)} totalMs=${result.timings.totalMs}`,
  )
}

export async function handleCommitCommand(parsed: Extract<ParsedCommand, { kind: 'commit' }>): Promise<void> {
  const config = await loadConfig()
  const presetName = parsed.options.preset ?? config.presets.default
  const preset = presetName ? config.presets.named[presetName] : undefined
  if (presetName && !preset) {
    throw new UsageError(`Unknown preset '${presetName}'`)
  }

  const effectiveOptions = mergeRunOptionsWithPreset(parsed.options, preset)
  const workspace = resolveWorkspacePath(effectiveOptions.workspace, config.workspace.last)
  const gitRead = createGitRead({ cwd: workspace })
  const gitExec = createGitExec({ cwd: workspace })
  const diff = readStagedDiff(gitRead)
  const result = await runRequest({
    input: {
      prompt: buildCommitPrompt(diff),
      provider: effectiveOptions.provider,
      model: effectiveOptions.model,
      workspace,
      mode: effectiveOptions.mode,
      trust: effectiveOptions.trust,
      output: 'plain',
      timeoutMs: effectiveOptions.timeoutMs,
      noFallback: effectiveOptions.noFallback,
      yolo: effectiveOptions.yolo,
      outputFormat: 'text',
      headless: true,
    },
    config,
    persistLastUsed: false,
  })

  const message = normalizeCommitMessage(result.response)
  if (parsed.options.apply) {
    applyCommitMessage(message, gitExec)
  }

  writeLine(message)
  writeVerbose(
    parsed.globals,
    `[genie] command=commit provider=${result.provider} apply=${String(parsed.options.apply)} fallback=${String(result.fallbackUsed)} totalMs=${result.timings.totalMs}`,
  )
}

export async function handleDebugCommand(parsed: Extract<ParsedCommand, { kind: 'debug' }>): Promise<void> {
  const config = await loadConfig()
  const presetName = parsed.options.preset ?? config.presets.default
  const preset = presetName ? config.presets.named[presetName] : undefined
  if (presetName && !preset) {
    throw new UsageError(`Unknown preset '${presetName}'`)
  }

  const effectiveOptions = mergeRunOptionsWithPreset(parsed.options, preset)
  const input = readDebugInput(parsed.options.inputFile)
  const workspace = resolveWorkspacePath(effectiveOptions.workspace, config.workspace.last)
  const result = await runRequest({
    input: {
      prompt: buildDebugPrompt(input),
      provider: effectiveOptions.provider,
      model: effectiveOptions.model,
      workspace,
      mode: effectiveOptions.mode,
      trust: effectiveOptions.trust,
      output: 'plain',
      timeoutMs: effectiveOptions.timeoutMs,
      noFallback: effectiveOptions.noFallback,
      yolo: effectiveOptions.yolo,
      outputFormat: 'text',
      headless: true,
    },
    config,
    persistLastUsed: false,
  })

  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('debug_result', toResponseEnvelope(result)))
  } else {
    writeLine(result.response)
  }
  writeVerbose(
    parsed.globals,
    `[genie] command=debug provider=${result.provider} fallback=${String(result.fallbackUsed)} totalMs=${result.timings.totalMs}`,
  )
}
