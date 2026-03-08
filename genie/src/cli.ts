import { readFileSync } from 'node:fs'

import {
  formatCliError,
  getExitCode,
  UsageError,
} from './errors.js'
import {
  configGet,
  configInit,
  configPath,
  configSet,
  previewConfigInit,
  previewConfigSet,
} from './config/commands.js'
import { loadConfig } from './config/store.js'
import { providerIds, type CliOutputMode, type ProviderPreset } from './types.js'
import { resolveWorkspacePath } from './runtime/workspace.js'
import { isInteractiveSession, resolveRuntimeState } from './runtime/tty.js'
import {
  executeReviewCommand,
  formatReviewReport,
  getReviewJsonSchema,
  toReviewJsonEnvelope,
} from './review/command.js'
import { formatUpdateResult, previewUpdateCommand, runUpdateCommand } from './update/command.js'
import { buildDebugPrompt, readDebugInput } from './debug/command.js'
import { buildDesignPrompt } from './design/command.js'
import {
  applyCommitMessage,
  buildCommitPrompt,
  createGitExec,
  createGitRead,
  normalizeCommitMessage,
  readStagedDiff,
} from './commit/command.js'
import {
  runRequest,
  toResponseEnvelope,
  type RunRequestInput,
} from './execution/run-request.js'
import { doctorProviders, listProviders } from './providers/doctor.js'
import { deletePreset, getPreset, listPresets, previewDeletePreset, previewSetPreset, previewUsePreset, setPreset, usePreset } from './presets/commands.js'
import { toCliJsonErrorEnvelope, toCliJsonSuccessEnvelope } from './cli/json.js'
import { renderCompletion } from './cli/completion.js'
import { normalizeTextInput, readTextInput } from './cli/input.js'
import { parseArgv } from './cli/parse.js'
import { resolveMutationDecision } from './cli/safety.js'
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
    'genie',
    'Unified AI CLI for prompt execution, terminal debugging, diff review, and provider-aware automation.',
    '',
    'Start here:',
    '  genie "<prompt>"',
    '  npm test 2>&1 | genie debug',
    '  genie review --all',
    '  genie providers doctor',
    '',
    'Common workflows:',
    '  run        Execute a prompt with provider routing, presets, and fallback.',
    '  design     Get frontend design feedback and UI recommendations.',
    '  debug      Diagnose terminal errors from stdin.',
    '  review     Review the current diff with one agent or all agents.',
    '  providers  Check provider availability and auth health.',
    '  presets    Save reusable run defaults for common setups.',
    '  config     Inspect and change config values.',
    '  update     Refresh the local genie install.',
    '',
    'Examples:',
    '  genie "summarize the current branch"',
    '  genie run --preset headless-codex "explain this repo layout"',
    '  genie design "review the onboarding hero and primary CTA hierarchy"',
    '  genie run --prompt-file prompt.txt',
    '  npm test 2>&1 | genie debug --provider claude',
    '  genie review --all --base origin/main',
    '  genie providers doctor --json',
    '',
    'Next commands:',
    '  genie help run',
    '  genie help design',
    '  genie help review',
    '  genie presets list',
    '  genie config path',
    '',
    'Command reference:',
    '  genie run [options] <prompt>',
    '  genie design [options] <prompt>',
    '  genie commit [options]',
    '  genie debug [options]',
    '  genie review [--all | --agent <id>] [--diff-file <path> | --staged | --base <ref>] [--json]',
    '  genie review --json-schema',
    '  genie update [--json] [--dry-run] [--force]',
    '  genie providers list [--json]',
    '  genie providers doctor [--provider <id>] [--json]',
    '  genie config get [key] [--json]',
    '  genie config set <key> <value> [--dry-run]',
    '  genie config init [--dry-run] [--force]',
    '  genie config path [--json]',
    '  genie presets list [--json]',
    '  genie presets get <name> [--json]',
    '  genie presets set <name> [options] [--dry-run] [--force]',
    '  genie presets delete <name> [--dry-run] [--force]',
    '  genie presets use <name> [--dry-run]',
    '  genie completion <bash|zsh|fish>',
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
    'Help topics:',
    '  genie help run',
    '  genie help design',
    '  genie help commit',
    '  genie help debug',
    '  genie help review',
    '  genie help providers',
    '  genie help config',
    '  genie help presets',
    '  genie help update',
    '  genie help completion',
    '',
    `Providers: ${providerIds.join(', ')}`,
  ]

  const run = [
    'Usage: genie run [options] <prompt>',
    'Execute a prompt with provider routing, config defaults, and machine-readable output modes.',
    '',
    'Common flows:',
    '  genie run "summarize this repo"',
    '  genie run --provider codex --no-fallback "generate release notes"',
    '  genie run --preset headless-codex --json "list risky files"',
    '',
    'Options:',
    '  -p, --provider <claude|codex|cursor-agent|gemini>',
    '  -m, --model <name>',
    '  -w, --workspace <path>',
    '  --mode <name>',
    '  --trust',
    '  --preset <name>',
    '  --prompt-file <path|->',
    '  --yolo',
    '  --include-directories <a,b,c>',
    '  --output-format <text|json|stream-json>',
    '  --print',
    '  --extensions <a,b,c>',
    '  --mcp <a,b,c>',
    '  --timeout-ms <n>',
    '  --no-fallback',
    '',
    'Config and precedence:',
    '  flags > GENIE_* env vars > .genie/config.json > ~/.config/genie/config.json > defaults',
    '  Relevant env vars: GENIE_PROVIDER, GENIE_MODEL, GENIE_MODE, GENIE_WORKSPACE, GENIE_TRUST, GENIE_TIMEOUT_MS, GENIE_OUTPUT',
    '',
    'Recovery tips:',
    '  Use `genie providers doctor` when a provider is unavailable or unauthenticated.',
    '  Use `--no-fallback` to isolate one provider while debugging a failure.',
    '  Use `genie help config` to inspect supported defaults and config keys.',
    '  Use `--prompt-file <path>` for saved prompt text or `--prompt-file -` to read stdin.',
  ]

  const design = [
    'Usage: genie design [options] <prompt>',
    'Get frontend design feedback and implementation-aware UI recommendations through the normal provider pipeline.',
    '',
    'Common flows:',
    '  genie design "review the pricing page hierarchy and CTA emphasis"',
    '  genie design --provider codex --no-fallback "critique the dashboard empty state"',
    '  genie design --prompt-file brief.txt --json',
    '',
    'Options:',
    '  -p, --provider <claude|codex|cursor-agent|gemini>',
    '  -m, --model <name>',
    '  -w, --workspace <path>',
    '  --mode <name>',
    '  --trust',
    '  --preset <name>',
    '  --prompt-file <path|->',
    '  --yolo',
    '  --timeout-ms <n>',
    '  --no-fallback',
    '',
    'Config and precedence:',
    '  flags > GENIE_* env vars > .genie/config.json > ~/.config/genie/config.json > defaults',
    '  Relevant env vars: GENIE_PROVIDER, GENIE_MODEL, GENIE_MODE, GENIE_WORKSPACE, GENIE_TRUST, GENIE_TIMEOUT_MS, GENIE_OUTPUT',
    '',
    'Recovery tips:',
    '  Pass the design brief directly or use `--prompt-file <path>` for longer review requests.',
    '  Use `--no-fallback` to isolate one provider while tuning recommendation quality.',
    '  Use `--json` when you need structured automation-friendly output.',
  ]

  const review = [
    'Usage: genie review [--all | --agent <codex|claude|gemini|cursor>] [--diff-file <path> | --staged | --base <ref>]',
    'Review repository changes with one agent or all agents and emit either human text or stable JSON.',
    '',
    'Common flows:',
    '  genie review --all',
    '  genie review --agent codex --staged',
    '  genie review --all --base origin/main',
    '  genie review --all --diff-file saved.patch --json',
    '',
    'Options:',
    '  --all',
    '  --agent <id>',
    '  --diff-file <path>',
    '  --staged',
    '  --base <ref>',
    '  --json-schema',
    '',
    'Recovery tips:',
    '  Choose exactly one target: `--all` or `--agent <id>`.',
    '  Choose one diff source: default git diff, `--staged`, `--base <ref>`, or `--diff-file <path>`.',
    '  Run `git status` first if review says there are no changes or git diff resolution failed.',
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
    'Read terminal error output from stdin and return a diagnosis through the normal provider pipeline.',
    '',
    'Common flows:',
    '  npm test 2>&1 | genie debug',
    '  cat error.log | genie debug --provider claude --no-fallback',
    '  bun run build 2>&1 | genie debug --json',
    '  genie debug --input-file error.log --provider claude',
    '',
    'Options:',
    '  -p, --provider <claude|codex|cursor-agent|gemini>',
    '  -m, --model <name>',
    '  -w, --workspace <path>',
    '  --mode <name>',
    '  --trust',
    '  --preset <name>',
    '  --input-file <path|->',
    '  --yolo',
    '  --timeout-ms <n>',
    '  --no-fallback',
    '',
    'Config and precedence:',
    '  flags > GENIE_* env vars > .genie/config.json > ~/.config/genie/config.json > defaults',
    '  Relevant env vars: GENIE_PROVIDER, GENIE_MODEL, GENIE_MODE, GENIE_WORKSPACE, GENIE_TRUST, GENIE_TIMEOUT_MS, GENIE_OUTPUT',
    '',
    'Recovery tips:',
    '  Pipe stderr/stdout into debug instead of passing error text as argv.',
    '  If you need a single provider diagnosis, add `--provider <id> --no-fallback`.',
    '  Use `--input-file <path>` for saved logs or `--input-file -` to read stdin explicitly.',
  ]

  const update = [
    'Usage: genie update [--json] [--dry-run] [--force]',
    'Refresh the local genie install in place.',
    '',
    'What it runs:',
    '  1) bun run build',
    '  2) bun link',
    '',
    'Common flows:',
    '  genie update',
    '  genie update --dry-run',
    '  genie update --force --json',
    '',
    'Next command:',
    '  genie --version',
    '',
    'Safety:',
    '  Use `--dry-run` to preview the build/link plan.',
    '  Use `--force` to skip the confirmation prompt.',
  ]

  const providers = [
    'Usage: genie providers <subcommand>',
    'Inspect provider inventory and diagnose availability/auth issues before running prompts.',
    '',
    'Subcommands:',
    '  list [--json]',
    '  doctor [--provider <id>] [--json]',
    '',
    'Common flows:',
    '  genie providers list',
    '  genie providers doctor',
    '  genie providers doctor --provider codex --json',
    '',
    'Recovery tips:',
    '  Run `genie providers doctor` before blaming prompt execution failures on the CLI.',
    '  Use `genie providers list --json` when scripting provider selection.',
  ]

  const config = [
    'Usage: genie config <subcommand>',
    'Inspect and change persistent defaults that affect run/debug behavior.',
    '',
    'Subcommands:',
    '  get [key] [--json]',
    '  set <key> <value> [--dry-run]',
    '  init [--dry-run] [--force]',
    '  path [--json]',
    '',
    'Supported keys:',
    '  provider.default',
    '  provider.fallbackOrder',
    '  model.byProvider',
    '  mode.default',
    '  workspace.last',
    '  output.default',
    '  trust.default',
    '  runtime.timeoutMs',
    '',
    'Config locations and precedence:',
    '  User config: ~/.config/genie/config.json',
    '  Project config: <repo>/.genie/config.json',
    '  Precedence: flags > GENIE_* env vars > project config > user config > defaults',
    '',
    'Supported env vars:',
    '  GENIE_PROVIDER',
    '  GENIE_MODEL',
    '  GENIE_MODE',
    '  GENIE_WORKSPACE',
    '  GENIE_TRUST',
    '  GENIE_TIMEOUT_MS',
    '  GENIE_OUTPUT',
    '  GENIE_STRICT_COMMANDS',
    '',
    'Common flows:',
    '  genie config init',
    '  genie config get provider.default',
    '  genie config set provider.default codex --dry-run',
    '  genie config path',
    '',
    'Safety:',
    '  Use `--dry-run` to preview config changes without writing the user config file.',
    '  `config init` asks before overwriting an existing user config unless you pass `--force`.',
  ]

  const presets = [
    'Usage: genie presets <subcommand>',
    'Save reusable run defaults so repeated provider setups become one named preset.',
    '',
    'Subcommands:',
    '  list [--json]',
    '  get <name> [--json]',
    '  set <name> [--provider <id>] [--model <name>] [--mode <name>] [--trust] [--yolo] [--print]',
    '      [--include-directories <a,b,c>] [--output-format <text|json|stream-json>] [--extensions <a,b,c>] [--mcp <a,b,c>] [--default] [--dry-run] [--force]',
    '  delete <name> [--dry-run] [--force]',
    '  use <name> [--dry-run]',
    '',
    'Common flows:',
    '  genie presets set headless-codex --provider codex --yolo --default --dry-run',
    '  genie presets list',
    '  genie presets use headless-codex',
    '',
    'Recovery tips:',
    '  Run `genie presets list` if you are not sure which preset names exist.',
    '  Run `genie presets get <name>` to inspect what a preset will apply before using it.',
    '',
    'Safety:',
    '  Use `--dry-run` to preview preset changes.',
    '  `presets set` asks before overwriting an existing preset unless you pass `--force`.',
    '  `presets delete` asks before deleting a preset unless you pass `--force`.',
  ]

  const completion = [
    'Usage: genie completion <bash|zsh|fish>',
    'Generate shell completion scripts for the current command surface.',
    '',
    'Common flows:',
    '  genie completion bash > ~/.local/share/bash-completion/completions/genie',
    '  genie completion zsh > ~/.zfunc/_genie',
    '  genie completion fish > ~/.config/fish/completions/genie.fish',
    '',
    'Install notes:',
    '  bash: source the generated file or restart your shell after writing it to your completions directory.',
    '  zsh: add the directory to `fpath` and run `autoload -U compinit && compinit` if needed.',
    '  fish: writing the file into `~/.config/fish/completions/` is enough for the next shell session.',
  ]

  if (topic === 'run') return run.join('\n')
  if (topic === 'design') return design.join('\n')
  if (topic === 'commit') return commit.join('\n')
  if (topic === 'debug') return debug.join('\n')
  if (topic === 'review') return review.join('\n')
  if (topic === 'update') return update.join('\n')
  if (topic === 'providers') return providers.join('\n')
  if (topic === 'config') return config.join('\n')
  if (topic === 'presets') return presets.join('\n')
  if (topic === 'completion') return completion.join('\n')
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

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function writeLine(line: string): void {
  process.stdout.write(line)
  if (!line.endsWith('\n')) {
    process.stdout.write('\n')
  }
}

function writeVerbose(globals: GlobalOptions, line: string): void {
  if (!globals.verbose) return
  process.stderr.write(`${line}\n`)
}

function shouldUseJson(globals: GlobalOptions): boolean {
  return globals.json && !globals.plain
}

function shouldWriteStatusOutput(globals: GlobalOptions): boolean {
  return !globals.quiet
}

function writeCancellation(globals: GlobalOptions, kind: string, message: string): void {
  if (shouldUseJson(globals)) {
    writeJson(toCliJsonSuccessEnvelope(kind, { cancelled: true }))
    return
  }

  if (shouldWriteStatusOutput(globals)) {
    writeLine(message)
  }
}

function writeConfigValue(value: unknown): void {
  if (typeof value === 'string') {
    writeLine(value)
    return
  }

  writeLine(JSON.stringify(value, null, 2))
}

function resolveRunPrompt(prompt: string | undefined, promptFile: string | undefined): string {
  if (prompt) {
    return prompt
  }

  if (!promptFile) {
    throw new UsageError('Prompt is required')
  }

  return normalizeTextInput(readTextInput(promptFile), 'Prompt is required')
}

async function withGlobalFlagEnvironment<T>(globals: GlobalOptions | undefined, run: () => Promise<T>): Promise<T> {
  if (!globals || (!globals.noColor && !globals.noInput)) {
    return run()
  }

  const previousNoColor = process.env.NO_COLOR
  const previousCi = process.env.CI

  if (globals.noColor) {
    process.env.NO_COLOR = '1'
  }
  if (globals.noInput) {
    process.env.CI = 'true'
  }

  try {
    return await run()
  } finally {
    if (previousNoColor === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = previousNoColor
    }

    if (previousCi === undefined) {
      delete process.env.CI
    } else {
      process.env.CI = previousCi
    }
  }
}

async function executeCommand(
  parsed: ParsedCommand,
  deps?: { confirm?: (prompt: string) => Promise<boolean> },
): Promise<void> {
  if (parsed.kind === 'help') {
    writeLine(usage(parsed.topic))
    return
  }

  if (parsed.kind === 'version') {
    writeLine(readPackageVersion())
    return
  }

  if (parsed.kind === 'completion') {
    writeLine(renderCompletion(parsed.shell))
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

    return
  }

  if (parsed.kind === 'design') {
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
      const envelope = toReviewJsonEnvelope(result)
      writeJson({
        kind: envelope.kind,
        version: envelope.version,
        ok: result.exitCode === 0,
        mode: envelope.mode,
        targets: envelope.targets,
        source: envelope.source,
        cwd: envelope.cwd,
        git: envelope.git,
        diff: envelope.diff,
        summary: envelope.summary,
        results: envelope.results,
        exitCode: envelope.exitCode,
        error: null,
      })
    } else {
      writeLine(formatReviewReport(result))
    }

    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode
    }
    writeVerbose(
      parsed.globals,
      `[genie] command=review mode=${result.mode} targets=${result.agents.join(',')} exitCode=${result.exitCode} source=${result.source}`,
    )
    return
  }

  if (parsed.kind === 'update') {
    const decision = await resolveMutationDecision({
      action: 'Updating the local genie install',
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
      `[genie] command=update steps=${result.steps.map((step) => `${step.step}:${step.code}`).join(',')} packageRoot=${result.packageRoot}`,
    )
    return
  }

  if (parsed.kind === 'providers-list') {
    const providers = await listProviders()
    if (shouldUseJson(parsed.globals)) {
      writeJson(toCliJsonSuccessEnvelope('providers_list', { providers }))
      return
    }
    for (const provider of providers) {
      writeLine(provider.id)
    }
    writeVerbose(parsed.globals, `[genie] command=providers-list count=${providers.length}`)
    return
  }

  if (parsed.kind === 'providers-doctor') {
    const report = await doctorProviders(parsed.provider)
    if (shouldUseJson(parsed.globals)) {
      writeJson(toCliJsonSuccessEnvelope('providers_doctor', { providers: report }))
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
      writeVerbose(
        parsed.globals,
        `[genie] command=providers-doctor provider=${status.provider} available=${String(status.available)} authenticated=${String(status.authenticated)} latencyMs=${status.latencyMs}`,
      )
    }
    return
  }

  if (parsed.kind === 'config-get') {
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
    return
  }

  if (parsed.kind === 'config-set') {
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
    return
  }

  if (parsed.kind === 'config-init') {
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
    return
  }

  if (parsed.kind === 'presets-list') {
    const value = await listPresets()
    if (shouldUseJson(parsed.globals)) {
      writeJson(toCliJsonSuccessEnvelope('presets_list', value))
      return
    }
    writeConfigValue(value)
    writeVerbose(parsed.globals, `[genie] command=presets-list count=${Object.keys(value.named).length}`)
    return
  }

  if (parsed.kind === 'presets-get') {
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
    return
  }

  if (parsed.kind === 'presets-set') {
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
    return
  }

  if (parsed.kind === 'presets-delete') {
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
    return
  }

  if (parsed.kind === 'presets-use') {
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
    return
  }

  if (parsed.kind === 'config-path') {
    const paths = configPath()
    if (shouldUseJson(parsed.globals)) {
      writeJson(toCliJsonSuccessEnvelope('config_path', { paths }))
      return
    }
    writeConfigValue(paths)
    writeVerbose(parsed.globals, '[genie] command=config-path')
    return
  }

  throw new UsageError('Unknown command kind')
}

export async function runFromArgv(
  argv: string[],
  deps?: { confirm?: (prompt: string) => Promise<boolean> },
): Promise<void> {
  const parsed = parseArgv(argv)
  const globals = 'globals' in parsed ? parsed.globals : undefined
  await withGlobalFlagEnvironment(globals, async () => executeCommand(parsed, deps))
}

export async function cli(argv: string[] = process.argv.slice(2)): Promise<void> {
  try {
    await runFromArgv(argv)
  } catch (error) {
    const code = getExitCode(error)
    const message = formatCliError(error)
    const optionArgs = argv.includes('--') ? argv.slice(0, argv.indexOf('--')) : argv
    const wantsJson = optionArgs.includes('--json') && !optionArgs.includes('--plain')

    if (wantsJson) {
      writeJson(toCliJsonErrorEnvelope(code, { code: String(code), message }))
    } else {
      process.stderr.write(`${message}\n`)
    }
    process.exitCode = code
  }
}
