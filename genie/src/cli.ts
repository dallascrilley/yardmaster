import { readFileSync } from 'node:fs'

import {
  AggregatedProviderError,
  getExitCode,
  UsageError,
} from './errors.js'
import {
  configGet,
  configInit,
  configPath,
  configSet,
} from './config/commands.js'
import { loadConfig } from './config/store.js'
import { providerIds, type CliOutputMode, type ProviderFailureReason, type ProviderPreset } from './types.js'
import { resolveWorkspacePath } from './runtime/workspace.js'
import { resolveRuntimeState } from './runtime/tty.js'
import {
  executeReviewCommand,
  formatReviewReport,
  getReviewJsonSchema,
  toReviewJsonEnvelope,
} from './review/command.js'
import { formatUpdateResult, runUpdateCommand } from './update/command.js'
import { buildDebugPrompt, readDebugInput } from './debug/command.js'
import { applyCommitMessage, buildCommitPrompt, normalizeCommitMessage, readStagedDiff } from './commit/command.js'
import {
  runRequest,
  toErrorEnvelope,
  toResponseEnvelope,
  type RunRequestInput,
} from './execution/run-request.js'
import { doctorProviders, listProviders } from './providers/doctor.js'
import { deletePreset, getPreset, listPresets, setPreset, usePreset } from './presets/commands.js'
import { parseArgv } from './cli/parse.js'
import type { GlobalOptions, HelpTopic, ParsedCommand, RunOptions } from './cli/types.js'

export { parseArgv } from './cli/parse.js'

function readPackageVersion(): string {
  try {
    const pkgPath = new URL('../package.json', import.meta.url)
    const raw = readFileSync(pkgPath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function usage(topic?: HelpTopic): string {
  const root = [
    'Usage:',
    '  genie <prompt>',
    '  genie run [options] <prompt>',
    '  genie commit [options]',
    '  genie debug [options]',
    '  genie review [--all | --agent <id>] [--diff-file <path> | --staged | --base <ref>] [--json]',
    '  genie review --json-schema',
    '  genie update [--json]',
    '  genie providers list [--json]',
    '  genie providers doctor [--provider <id>] [--json]',
    '  genie config get [key] [--json]',
    '  genie config set <key> <value>',
    '  genie config init',
    '  genie config path [--json]',
    '  genie presets list [--json]',
    '  genie presets get <name> [--json]',
    '  genie presets set <name> [options]',
    '  genie presets delete <name>',
    '  genie presets use <name>',
    '',
    'Global flags:',
    '  -h, --help',
    '  --version',
    '  --json',
    '  --plain',
    '  --no-color',
    '  -q, --quiet',
    '  -v, --verbose',
    '  --no-input',
    '',
    `Providers: ${providerIds.join(', ')}`,
  ]

  const run = [
    'Usage: genie run [options] <prompt>',
    '  -p, --provider <claude|codex|cursor-agent|gemini>',
    '  -m, --model <name>',
    '  -w, --workspace <path>',
    '  --mode <name>',
    '  --trust',
    '  --preset <name>',
    '  --yolo',
    '  --include-directories <a,b,c>',
    '  --output-format <text|json|stream-json>',
    '  --print',
    '  --extensions <a,b,c>',
    '  --mcp <a,b,c>',
    '  --timeout-ms <n>',
    '  --no-fallback',
  ]

  const review = [
    'Usage: genie review [--all | --agent <codex|claude|gemini|cursor>] [--diff-file <path> | --staged | --base <ref>]',
    '  --all',
    '  --agent <id>',
    '  --diff-file <path>',
    '  --staged',
    '  --base <ref>',
    '  --json-schema',
  ]

  const commit = [
    'Usage: genie commit [options]',
    'Reads staged git changes and generates a Conventional Commits message.',
    '  -a, --apply',
    '  -p, --provider <claude|codex|cursor-agent|gemini>',
    '  -m, --model <name>',
    '  -w, --workspace <path>',
    '  --mode <name>',
    '  --trust',
    '  --preset <name>',
    '  --yolo',
    '  --timeout-ms <n>',
    '  --no-fallback',
  ]

  const debug = [
    'Usage: genie debug [options]',
    'Reads terminal error output from stdin and returns a diagnosis.',
    '  -p, --provider <claude|codex|cursor-agent|gemini>',
    '  -m, --model <name>',
    '  -w, --workspace <path>',
    '  --mode <name>',
    '  --trust',
    '  --preset <name>',
    '  --yolo',
    '  --timeout-ms <n>',
    '  --no-fallback',
  ]

  const update = [
    'Usage: genie update [--json]',
    'Runs local refresh steps:',
    '  1) bun run build',
    '  2) bun link',
  ]

  const providers = [
    'Usage: genie providers <subcommand>',
    'Subcommands:',
    '  list [--json]',
    '  doctor [--provider <id>] [--json]',
  ]

  const config = [
    'Usage: genie config <subcommand>',
    'Subcommands:',
    '  get [key] [--json]',
    '  set <key> <value>',
    '  init',
    '  path [--json]',
  ]

  const presets = [
    'Usage: genie presets <subcommand>',
    'Subcommands:',
    '  list [--json]',
    '  get <name> [--json]',
    '  set <name> [--provider <id>] [--model <name>] [--mode <name>] [--trust] [--yolo] [--print]',
    '      [--include-directories <a,b,c>] [--output-format <text|json|stream-json>] [--extensions <a,b,c>] [--mcp <a,b,c>] [--default]',
    '  delete <name>',
    '  use <name>',
  ]

  if (topic === 'run') return run.join('\n')
  if (topic === 'commit') return commit.join('\n')
  if (topic === 'debug') return debug.join('\n')
  if (topic === 'review') return review.join('\n')
  if (topic === 'update') return update.join('\n')
  if (topic === 'providers') return providers.join('\n')
  if (topic === 'config') return config.join('\n')
  if (topic === 'presets') return presets.join('\n')
  return root.join('\n')
}

function mergeRunOptionsWithPreset(options: RunOptions, preset?: ProviderPreset): RunOptions {
  if (!preset) {
    return options
  }

  return {
    ...options,
    provider: options.provider ?? preset.provider,
    model: options.model ?? preset.model,
    mode: options.mode ?? preset.mode,
    trust: options.trust ?? preset.trust,
    yolo: options.yolo ?? preset.yolo,
    outputFormat: options.outputFormat ?? preset.outputFormat,
    includeDirectories: options.includeDirectories ?? preset.includeDirectories,
    headless: options.headless ?? preset.headless,
    extensions: options.extensions ?? preset.extensions,
    mcp: options.mcp ?? preset.mcp,
  }
}

function formatError(error: unknown): string {
  if (error instanceof AggregatedProviderError) {
    const lines = [
      'All providers failed. Enable a configured provider and try again.',
      ...error.reasons.map((item: ProviderFailureReason) =>
        `- ${item.provider} (${item.stage}): ${item.reason}${item.hint ? ` — ${item.hint}` : ''}`,
      ),
    ]
    return lines.join('\n')
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function writeLine(line: string): void {
  process.stdout.write(line)
  if (!line.endsWith('\n')) {
    process.stdout.write('\n')
  }
}

function shouldUseJson(globals: GlobalOptions): boolean {
  return globals.json && !globals.plain
}

function isDebugInvocation(argv: string[]): boolean {
  const positional = argv.filter((token) => !token.startsWith('-'))
  return positional[0] === 'debug'
}

function isCommitInvocation(argv: string[]): boolean {
  const positional = argv.filter((token) => !token.startsWith('-'))
  return positional[0] === 'commit'
}

function outputForConfigResult(globals: GlobalOptions, value: unknown): void {
  if (shouldUseJson(globals)) {
    writeJson(value)
    return
  }

  if (typeof value === 'string') {
    writeLine(value)
    return
  }

  writeLine(JSON.stringify(value, null, 2))
}

async function executeCommand(parsed: ParsedCommand): Promise<void> {
  if (parsed.kind === 'help') {
    writeLine(usage(parsed.topic))
    return
  }

  if (parsed.kind === 'version') {
    writeLine(readPackageVersion())
    return
  }

  if (parsed.kind === 'run') {
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
    })

    const request: RunRequestInput = {
      prompt: parsed.prompt,
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

    const envelope = toResponseEnvelope(result)
    if (runtime.ttyAwareMode === 'json') {
      writeJson(envelope)
    } else {
      writeLine(envelope.response)
    }

    if (parsed.globals.verbose) {
      process.stderr.write(
        `[genie] provider=${result.provider} fallback=${String(result.fallbackUsed)} totalMs=${result.timings.totalMs}\n`,
      )
    }

    return
  }

  if (parsed.kind === 'commit') {
    const config = await loadConfig()
    const presetName = parsed.options.preset ?? config.presets.default
    const preset = presetName ? config.presets.named[presetName] : undefined
    if (presetName && !preset) {
      throw new UsageError(`Unknown preset '${presetName}'`)
    }

    const effectiveOptions = mergeRunOptionsWithPreset(parsed.options, preset)
    const workspace = resolveWorkspacePath(effectiveOptions.workspace, config.workspace.last)
    const diff = readStagedDiff()
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
      applyCommitMessage(message)
    }

    writeLine(message)
    return
  }

  if (parsed.kind === 'debug') {
    const config = await loadConfig()
    const presetName = parsed.options.preset ?? config.presets.default
    const preset = presetName ? config.presets.named[presetName] : undefined
    if (presetName && !preset) {
      throw new UsageError(`Unknown preset '${presetName}'`)
    }

    const effectiveOptions = mergeRunOptionsWithPreset(parsed.options, preset)
    const input = readDebugInput()
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

    writeLine(result.response)
    return
  }

  if (parsed.kind === 'review') {
    if (parsed.options.jsonSchema) {
      writeJson(getReviewJsonSchema())
      return
    }

    const config = await loadConfig()
    const result = await executeReviewCommand({
      all: parsed.options.all,
      agent: parsed.options.agent,
      diffFile: parsed.options.diffFile,
      staged: parsed.options.staged,
      base: parsed.options.base,
      config,
    })

    if (shouldUseJson(parsed.globals)) {
      writeJson(toReviewJsonEnvelope(result))
    } else {
      writeLine(formatReviewReport(result))
    }

    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode
    }
    return
  }

  if (parsed.kind === 'update') {
    const result = runUpdateCommand()
    if (shouldUseJson(parsed.globals)) {
      writeJson(result)
    } else {
      writeLine(formatUpdateResult(result))
    }
    return
  }

  if (parsed.kind === 'providers-list') {
    const providers = await listProviders()
    if (shouldUseJson(parsed.globals)) {
      writeJson({ providers })
      return
    }
    for (const provider of providers) {
      writeLine(provider.id)
    }
    return
  }

  if (parsed.kind === 'providers-doctor') {
    const report = await doctorProviders(parsed.provider)
    if (shouldUseJson(parsed.globals)) {
      writeJson({ providers: report })
      return
    }

    for (const status of report) {
      const line = [
        status.provider,
        status.available ? 'available' : 'missing',
        status.authenticated ? 'authenticated' : 'unauthenticated',
        `${status.latencyMs}ms`,
      ].join(' | ')
      writeLine(line)
      if (status.hint && !parsed.globals.quiet) {
        process.stderr.write(`hint (${status.provider}): ${status.hint}\n`)
      }
    }
    return
  }

  if (parsed.kind === 'config-get') {
    const value = await configGet(parsed.key)
    outputForConfigResult(parsed.globals, value)
    return
  }

  if (parsed.kind === 'config-set') {
    const updated = await configSet(parsed.key, parsed.value)
    if (shouldUseJson(parsed.globals)) {
      writeJson(updated)
      return
    }
    writeLine(`Set ${parsed.key}`)
    return
  }

  if (parsed.kind === 'config-init') {
    const created = await configInit()
    if (shouldUseJson(parsed.globals)) {
      writeJson(created)
      return
    }
    writeLine('Initialized user config')
    return
  }

  if (parsed.kind === 'presets-list') {
    const value = await listPresets()
    outputForConfigResult(parsed.globals, value)
    return
  }

  if (parsed.kind === 'presets-get') {
    const value = await getPreset(parsed.name)
    outputForConfigResult(parsed.globals, value)
    return
  }

  if (parsed.kind === 'presets-set') {
    const result = await setPreset(
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
    outputForConfigResult(parsed.globals, result)
    return
  }

  if (parsed.kind === 'presets-delete') {
    const result = await deletePreset(parsed.name)
    outputForConfigResult(parsed.globals, result)
    return
  }

  if (parsed.kind === 'presets-use') {
    const result = await usePreset(parsed.name)
    outputForConfigResult(parsed.globals, result)
    return
  }

  const paths = configPath()
  outputForConfigResult(parsed.globals, paths)
}

export async function runFromArgv(argv: string[]): Promise<void> {
  const parsed = parseArgv(argv)
  await executeCommand(parsed)
}

export async function cli(argv: string[] = process.argv.slice(2)): Promise<void> {
  try {
    await runFromArgv(argv)
  } catch (error) {
    const code = getExitCode(error)
    const message = formatError(error)
    const wantsJson =
      argv.includes('--json') && !argv.includes('--plain') && !isDebugInvocation(argv) && !isCommitInvocation(argv)

    if (wantsJson) {
      writeJson(
        toErrorEnvelope({
          code: String(code),
          message,
        }),
      )
    }

    process.stderr.write(`${message}\n`)
    process.exitCode = code
  }
}
