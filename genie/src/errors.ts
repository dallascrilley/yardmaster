import { type ProviderFailureReason } from './types.js'

export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

export class RuntimeProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeProviderError'
  }
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthConfigurationError'
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class AggregatedProviderError extends Error {
  constructor(public readonly reasons: ProviderFailureReason[]) {
    const lines = reasons
      .map((r) => `${r.provider} (${r.stage}): ${r.reason}${r.durationMs ? ` [${r.durationMs}ms]` : ''}`)
      .join('\n')
    super(`No provider succeeded.\n${lines}`)
    this.name = 'AggregatedProviderError'
  }

  hasOnlyAuthOrConfigFailures(): boolean {
    return this.reasons.length > 0 && this.reasons.every((item) => item.authFailure)
  }

  hasTimeoutFailure(): boolean {
    return this.reasons.some((item) => item.timeout)
  }
}

export function getExitCode(error: unknown): number {
  if (error instanceof UsageError) {
    return 2
  }

  if (error instanceof TimeoutError) {
    return 124
  }

  if (error instanceof AuthConfigurationError) {
    return 3
  }

  if (error instanceof AggregatedProviderError) {
    if (error.hasOnlyAuthOrConfigFailures()) {
      return 3
    }
    if (error.hasTimeoutFailure()) {
      return 124
    }
    return 1
  }

  if (error instanceof RuntimeProviderError) {
    return 1
  }

  if (error instanceof Error && /timed out/i.test(error.message)) {
    return 124
  }

  return 1
}

function withNextSteps(message: string, steps: string[]): string {
  if (steps.length === 0) return message
  return [message, '', 'Next steps:', ...steps.map((step) => `- ${step}`)].join('\n')
}

function usageSuggestions(message: string): string[] {
  if (/Unknown command /.test(message)) {
    return ['Run `genie help` to see the available commands.', 'Use `genie run "<prompt>"` for prompt execution.']
  }

  if (/Unknown help topic /.test(message)) {
    return ['Run `genie help` to list valid help topics.']
  }

  if (/Unknown provider |Invalid provider /.test(message)) {
    return ['Run `genie providers list` to see supported providers.', 'Run `genie providers doctor --provider <id>` after choosing a provider.']
  }

  if (/Unknown preset /.test(message) || /Preset name cannot be empty/.test(message)) {
    return ['Run `genie presets list` to inspect saved presets.', 'Use `genie presets set <name> --provider codex` to create a new preset.']
  }

  if (/Unknown config key /.test(message)) {
    return ['Run `genie help config` to see supported config keys and commands.']
  }

  if (/A review target is required|--all cannot be used with --agent/.test(message)) {
    return ['Choose exactly one target: `genie review --all` or `genie review --agent codex`.', 'Run `genie help review` for the full review syntax.']
  }

  if (/--staged cannot be used with --diff-file|--base cannot be used with --diff-file|--base cannot be used with --staged/.test(message)) {
    return ['Pick one diff source: `--diff-file`, `--staged`, or `--base <ref>`.', 'Run `genie help review` for valid flag combinations.']
  }

  if (/Unable to read --diff-file|Failed to read git diff|Failed to resolve --base|Failed to resolve base branch diff candidates/.test(message)) {
    return ['Run `git status` to confirm repository state and available changes.', 'Use `genie review --diff-file <path>` if you want to review a saved patch instead of git state.']
  }

  if (/No terminal error input provided/.test(message)) {
    return ['Pipe terminal output into debug, for example `npm test 2>&1 | genie debug`.']
  }

  if (/Prompt is required/.test(message)) {
    return ['Pass prompt text directly, for example `genie run "summarize this diff"`.', 'Run `genie help run` to review run flags.']
  }

  if (/Failed to read input file /.test(message)) {
    return ['Check that the path exists and is readable.', 'Use `-` to read from stdin instead of a file path when piping input.']
  }

  if (/Failed to read stdin/.test(message)) {
    return ['Pipe input into the command or pass a file path flag instead.', 'Run `genie help run` or `genie help debug` for input examples.']
  }

  if (/Missing value for |Invalid value for |Unknown output format |Unknown mode /.test(message)) {
    return ['Run `genie help run` to review valid flags and accepted values.']
  }

  if (/Unknown review argument /.test(message)) {
    return ['Run `genie help review` to review valid review flags.']
  }

  if (/Unknown update argument /.test(message)) {
    return ['Run `genie help update` to review valid update flags.']
  }

  if (/Unknown providers argument /.test(message)) {
    return ['Run `genie help providers` to review valid providers subcommands and flags.']
  }

  if (/Unexpected positional argument /.test(message)) {
    return ['Pipe terminal output into debug instead of passing it as argv text.', 'Example: `npm test 2>&1 | genie debug --provider claude`.']
  }

  if (/requires confirmation/.test(message)) {
    return ['Re-run with `--force` to apply the change non-interactively.', 'Use `--dry-run` to preview the mutation without writing anything.']
  }

  return ['Run `genie help` for usage.']
}

export function formatCliError(error: unknown): string {
  if (error instanceof AggregatedProviderError) {
    const lines = [
      'All providers failed. Enable a configured provider and try again.',
      ...error.reasons.map((r) => `- ${r.provider} (${r.stage}): ${r.reason}${r.hint ? ` — ${r.hint}` : ''}`),
    ]
    return withNextSteps(lines.join('\n'), [
      'Run `genie providers doctor` to check installation and authentication state.',
      'Retry with `genie run --provider <id> --no-fallback "<prompt>"` once one provider is healthy.',
    ])
  }

  if (error instanceof AuthConfigurationError) {
    return withNextSteps(error.message, [
      'Run `genie providers doctor` to see which auth check is failing.',
      'Authenticate the failing provider CLI, then retry the original command.',
    ])
  }

  if (error instanceof TimeoutError || (error instanceof Error && /timed out/i.test(error.message))) {
    const message = error instanceof Error ? error.message : String(error)
    return withNextSteps(message, [
      'Retry with a higher timeout using `--timeout-ms <n>` if the provider is slow.',
      'Retry with `--no-fallback` to isolate one provider while debugging.',
    ])
  }

  if (error instanceof UsageError) {
    return withNextSteps(error.message, usageSuggestions(error.message))
  }

  if (error instanceof Error) {
    return withNextSteps(error.message, ['Run `genie help` if you need to verify command syntax before retrying.'])
  }

  return String(error)
}
