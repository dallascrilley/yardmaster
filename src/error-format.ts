function withNextSteps(message: string, steps: string[]): string {
  if (steps.length === 0) return message
  return [message, '', 'Next steps:', ...steps.map((step) => `- ${step}`)].join('\n')
}

function usageSuggestions(message: string): string[] {
  if (/Unknown command /.test(message)) {
    return ['Run `yardmaster help` to see the available commands.', 'Use `yardmaster run "<prompt>"` for prompt execution.']
  }

  if (/Unknown help topic /.test(message)) {
    return ['Run `yardmaster help` to list valid help topics.']
  }

  if (/Unknown provider |Invalid provider /.test(message)) {
    return ['Run `yardmaster providers list` to see supported providers.', 'Run `yardmaster providers doctor --provider <id>` after choosing a provider.']
  }

  if (/Unknown preset /.test(message) || /Preset name cannot be empty/.test(message)) {
    return ['Run `yardmaster presets list` to inspect saved presets.', 'Use `yardmaster presets set <name> --provider codex` to create a new preset.']
  }

  if (/Unknown config key /.test(message)) {
    return ['Run `yardmaster help config` to see supported config keys and commands.']
  }

  if (/A review target is required|--all cannot be used with --agent/.test(message)) {
    return ['Choose exactly one target: `yardmaster review --all` or `yardmaster review --agent codex`.', 'Run `yardmaster help review` for the full review syntax.']
  }

  if (/--staged cannot be used with --diff-file|--base cannot be used with --diff-file|--base cannot be used with --staged/.test(message)) {
    return ['Pick one diff source: `--diff-file`, `--staged`, or `--base <ref>`.', 'Run `yardmaster help review` for valid flag combinations.']
  }

  if (/Unable to read --diff-file|Failed to read git diff|Failed to resolve --base|Failed to resolve base branch diff candidates/.test(message)) {
    return ['Run `git status` to confirm repository state and available changes.', 'Use `yardmaster review --diff-file <path>` if you want to review a saved patch instead of git state.']
  }

  if (/No terminal error input provided/.test(message)) {
    return ['Pipe terminal output into debug, for example `npm test 2>&1 | yardmaster debug`.']
  }

  if (/Prompt is required/.test(message)) {
    return ['Pass prompt text directly, for example `yardmaster run "summarize this diff"`.', 'Run `yardmaster help run` to review run flags.']
  }

  if (/Failed to read input file /.test(message)) {
    return ['Check that the path exists and is readable.', 'Use `-` to read from stdin instead of a file path when piping input.']
  }

  if (/Failed to read stdin/.test(message)) {
    return ['Pipe input into the command or pass a file path flag instead.', 'Run `yardmaster help run` or `yardmaster help debug` for input examples.']
  }

  if (/Missing value for |Invalid value for |Unknown output format |Unknown mode /.test(message)) {
    return ['Run `yardmaster help run` to review valid flags and accepted values.']
  }

  if (/Unknown review argument /.test(message)) {
    return ['Run `yardmaster help review` to review valid review flags.']
  }

  if (/Unknown update argument /.test(message)) {
    return ['Run `yardmaster help update` to review valid update flags.']
  }

  if (/Unknown providers argument /.test(message)) {
    return ['Run `yardmaster help providers` to review valid providers subcommands and flags.']
  }

  if (/Unexpected positional argument /.test(message)) {
    return ['Pipe terminal output into debug instead of passing it as argv text.', 'Example: `npm test 2>&1 | yardmaster debug --provider claude`.']
  }

  if (/requires confirmation/.test(message)) {
    return ['Re-run with `--force` to apply the change non-interactively.', 'Use `--dry-run` to preview the mutation without writing anything.']
  }

  return ['Run `yardmaster help` for usage.']
}

export { usageSuggestions, withNextSteps }
