import { UsageError } from '../../errors.js'
import { loadConfig } from '../../config/store.js'
import { type CliOutputMode } from '../../types.js'
import { resolveWorkspacePath } from '../../runtime/workspace.js'
import { resolveRuntimeState } from '../../runtime/tty.js'
import { buildDebugPrompt, DEBUG_SYSTEM_PROMPT, readDebugInput } from '../../debug/command.js'
import { buildDesignPrompt, DESIGN_SYSTEM_PROMPT } from '../../design/command.js'
import {
  applyCommitMessage,
  buildCommitPrompt,
  COMMIT_SYSTEM_PROMPT,
  createGitExec,
  createGitRead,
  normalizeCommitMessage,
  readStagedDiff,
} from '../../commit/command.js'
import { runViaAcp } from '../../acp/run.js'
import { runAcpCommand } from '../../acp/command-runner.js'
import type { TrustMode } from '../../acp/host-handlers.js'
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

  const acpResult = await runViaAcp({
    prompt: resolveRunPrompt(parsed.prompt, effectiveOptions.promptFile),
    config,
    provider: effectiveOptions.provider,
    model: effectiveOptions.model,
    workspace,
    trust: effectiveOptions.trust,
    yolo: effectiveOptions.yolo,
    timeoutMs: effectiveOptions.timeoutMs,
    noFallback: effectiveOptions.noFallback,
    outputFormat: runtime.outputMode,
    session: effectiveOptions.session,
  })

  if (runtime.ttyAwareMode === 'json') {
    writeJson(toCliJsonSuccessEnvelope('run_result', { provider: acpResult.provider, stopReason: acpResult.stopReason }))
  }

  writeVerbose(
    parsed.globals,
    `[genie] command=run provider=${acpResult.provider} acp=true stopReason=${acpResult.stopReason}`,
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
  
  const trustMode: TrustMode = effectiveOptions.yolo ? 'yolo' : effectiveOptions.trust ? 'trust' : 'default'
  const response = await runAcpCommand({
    systemPrompt: DESIGN_SYSTEM_PROMPT,
    userPrompt: buildDesignPrompt(resolveRunPrompt(parsed.prompt, effectiveOptions.promptFile)),
    provider: effectiveOptions.provider,
    model: effectiveOptions.model,
    workspace,
    trustMode,
    timeoutMs: effectiveOptions.timeoutMs ?? config.runtime.timeoutMs,
    config,
    noFallback: effectiveOptions.noFallback,
  })

  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('design_result', { response }))
  } else {
    writeLine(response)
  }
  writeVerbose(
    parsed.globals,
    `[genie] command=design provider=${effectiveOptions.provider ?? config.provider.default}`,
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
  const gitExec = createGitExec({ cwd: workspace })
  
  // Verify there are staged changes
  const gitRead = createGitRead({ cwd: workspace })
  readStagedDiff(gitRead)
  
  const trustMode: TrustMode = effectiveOptions.yolo ? 'yolo' : effectiveOptions.trust ? 'trust' : 'default'
  const response = await runAcpCommand({
    systemPrompt: COMMIT_SYSTEM_PROMPT,
    userPrompt: buildCommitPrompt(),
    provider: effectiveOptions.provider,
    model: effectiveOptions.model,
    workspace,
    trustMode,
    timeoutMs: effectiveOptions.timeoutMs ?? config.runtime.timeoutMs,
    config,
    noFallback: effectiveOptions.noFallback,
  })

  const message = normalizeCommitMessage(response)
  if (parsed.options.apply) {
    applyCommitMessage(message, gitExec)
  }

  writeLine(message)
  writeVerbose(
    parsed.globals,
    `[genie] command=commit provider=${effectiveOptions.provider ?? config.provider.default} apply=${String(parsed.options.apply)}`,
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
  
  const trustMode: TrustMode = effectiveOptions.yolo ? 'yolo' : effectiveOptions.trust ? 'trust' : 'default'
  const response = await runAcpCommand({
    systemPrompt: DEBUG_SYSTEM_PROMPT,
    userPrompt: buildDebugPrompt(input),
    provider: effectiveOptions.provider,
    model: effectiveOptions.model,
    workspace,
    trustMode,
    timeoutMs: effectiveOptions.timeoutMs ?? config.runtime.timeoutMs,
    config,
    noFallback: effectiveOptions.noFallback,
  })

  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('debug_result', { response }))
  } else {
    writeLine(response)
  }
  writeVerbose(
    parsed.globals,
    `[genie] command=debug provider=${effectiveOptions.provider ?? config.provider.default}`,
  )
}
