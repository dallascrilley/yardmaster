import type { CompletionShell } from './types.js'

const rootCommands = ['run', 'design', 'commit', 'debug', 'review', 'update', 'providers', 'config', 'presets', 'help', 'completion']
const globalFlags = ['-h', '--help', '--version', '--json', '--plain', '--no-color', '-q', '--quiet', '-v', '--verbose', '--no-input']
const runFlags = ['-p', '--provider', '-m', '--model', '-w', '--workspace', '--mode', '--trust', '--preset', '--prompt-file', '--yolo', '--include-directories', '--output-format', '--print', '--extensions', '--mcp', '--timeout-ms', '--no-fallback']
const designFlags = ['-p', '--provider', '-m', '--model', '-w', '--workspace', '--mode', '--trust', '--preset', '--prompt-file', '--yolo', '--timeout-ms', '--no-fallback']
const commitFlags = ['-a', '--apply', '-p', '--provider', '-m', '--model', '-w', '--workspace', '--mode', '--trust', '--preset', '--yolo', '--timeout-ms', '--no-fallback']
const debugFlags = ['-p', '--provider', '-m', '--model', '-w', '--workspace', '--mode', '--trust', '--preset', '--input-file', '--yolo', '--timeout-ms', '--no-fallback']
const reviewFlags = ['--all', '--agent', '--diff-file', '--staged', '--base', '--json-schema']
const updateFlags = ['--dry-run', '--force']
const providersSubcommands = ['list', 'doctor']
const providersFlags = ['--provider', '--show-identity']
const configSubcommands = ['get', 'set', 'init', 'path']
const configFlags = ['--dry-run', '--force']
const presetsSubcommands = ['list', 'get', 'set', 'delete', 'use']
const presetsFlags = ['--provider', '--model', '--mode', '--trust', '--yolo', '--print', '--include-directories', '--output-format', '--extensions', '--mcp', '--default', '--dry-run', '--force']
const helpTopics = ['run', 'design', 'commit', 'debug', 'review', 'update', 'providers', 'config', 'presets', 'completion']
const shells = ['bash', 'zsh', 'fish']

function words(values: string[]): string {
  return values.join(' ')
}

function renderBash(): string {
  return `# bash completion for yardmaster
_yardmaster() {
  local cur prev cmd subcmd
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  cmd="\${COMP_WORDS[1]}"
  subcmd="\${COMP_WORDS[2]}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${words([...rootCommands, ...globalFlags])}" -- "$cur") )
    return
  fi

  case "$cmd" in
    run)
      COMPREPLY=( $(compgen -W "${words([...runFlags, ...globalFlags])}" -- "$cur") )
      ;;
    design)
      COMPREPLY=( $(compgen -W "${words([...designFlags, ...globalFlags])}" -- "$cur") )
      ;;
    commit)
      COMPREPLY=( $(compgen -W "${words([...commitFlags, ...globalFlags])}" -- "$cur") )
      ;;
    debug)
      COMPREPLY=( $(compgen -W "${words([...debugFlags, ...globalFlags])}" -- "$cur") )
      ;;
    review)
      COMPREPLY=( $(compgen -W "${words([...reviewFlags, ...globalFlags])}" -- "$cur") )
      ;;
    update)
      COMPREPLY=( $(compgen -W "${words([...updateFlags, ...globalFlags])}" -- "$cur") )
      ;;
    providers)
      if [[ \${COMP_CWORD} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "${words(providersSubcommands)}" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "${words([...providersFlags, ...globalFlags])}" -- "$cur") )
      fi
      ;;
    config)
      if [[ \${COMP_CWORD} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "${words(configSubcommands)}" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "${words([...configFlags, ...globalFlags])}" -- "$cur") )
      fi
      ;;
    presets)
      if [[ \${COMP_CWORD} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "${words(presetsSubcommands)}" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "${words([...presetsFlags, ...globalFlags])}" -- "$cur") )
      fi
      ;;
    help)
      COMPREPLY=( $(compgen -W "${words(helpTopics)}" -- "$cur") )
      ;;
    completion)
      COMPREPLY=( $(compgen -W "${words(shells)}" -- "$cur") )
      ;;
  esac
}

complete -F _yardmaster yardmaster
`
}

function renderZsh(): string {
  const rootChoices = [...rootCommands, ...globalFlags]
  const withGlobalFlags = (flags: string[], description: string): string =>
    [...flags, ...globalFlags].map((flag) => `'${flag}[${description}]'`).join(' ')

  return `#compdef yardmaster

local -a commands
commands=(
  'run:Execute a prompt'
  'design:Get frontend design feedback'
  'commit:Generate a commit message'
  'debug:Diagnose terminal output'
  'review:Review repository changes'
  'update:Refresh the local install'
  'providers:Inspect provider availability'
  'config:Inspect and change config'
  'presets:Manage named presets'
  'help:Show help topics'
  'completion:Generate shell completion'
)

if (( CURRENT == 2 )); then
  _values 'command or global option' ${rootChoices.map((value) => `'${value}'`).join(' ')}
  return
fi

case "$words[2]" in
  run)
    _arguments ${withGlobalFlags(runFlags, 'run option')}
    ;;
  design)
    _arguments ${withGlobalFlags(designFlags, 'design option')}
    ;;
  commit)
    _arguments ${withGlobalFlags(commitFlags, 'commit option')}
    ;;
  debug)
    _arguments ${withGlobalFlags(debugFlags, 'debug option')}
    ;;
  review)
    _arguments ${withGlobalFlags(reviewFlags, 'review option')}
    ;;
  update)
    _arguments ${withGlobalFlags(updateFlags, 'update option')}
    ;;
  providers)
    if (( CURRENT == 3 )); then
      _values 'providers subcommand' ${providersSubcommands.map((value) => `'${value}'`).join(' ')}
    else
      _arguments ${withGlobalFlags(providersFlags, 'providers option')}
    fi
    ;;
  config)
    if (( CURRENT == 3 )); then
      _values 'config subcommand' ${configSubcommands.map((value) => `'${value}'`).join(' ')}
    else
      _arguments ${withGlobalFlags(configFlags, 'config option')}
    fi
    ;;
  presets)
    if (( CURRENT == 3 )); then
      _values 'presets subcommand' ${presetsSubcommands.map((value) => `'${value}'`).join(' ')}
    else
      _arguments ${withGlobalFlags(presetsFlags, 'presets option')}
    fi
    ;;
  help)
    _values 'help topic' ${helpTopics.map((value) => `'${value}'`).join(' ')}
    ;;
  completion)
    _values 'shell' ${shells.map((value) => `'${value}'`).join(' ')}
    ;;
esac
`
}

function renderFish(): string {
  const lines = [
    '# fish completion for yardmaster',
    ...rootCommands.map((command) => `complete -c yardmaster -n "__fish_use_subcommand" -a "${command}"`),
    `complete -c yardmaster -f -s h -l help`,
    `complete -c yardmaster -f -l version`,
    `complete -c yardmaster -f -l json`,
    `complete -c yardmaster -f -l plain`,
    `complete -c yardmaster -f -l no-color`,
    `complete -c yardmaster -f -s q -l quiet`,
    `complete -c yardmaster -f -s v -l verbose`,
    `complete -c yardmaster -f -l no-input`,
    ...runFlags.map((flag) => `complete -c yardmaster -n "__fish_seen_subcommand_from run" -a "${flag}"`),
    ...designFlags.map((flag) => `complete -c yardmaster -n "__fish_seen_subcommand_from design" -a "${flag}"`),
    ...commitFlags.map((flag) => `complete -c yardmaster -n "__fish_seen_subcommand_from commit" -a "${flag}"`),
    ...debugFlags.map((flag) => `complete -c yardmaster -n "__fish_seen_subcommand_from debug" -a "${flag}"`),
    ...reviewFlags.map((flag) => `complete -c yardmaster -n "__fish_seen_subcommand_from review" -a "${flag}"`),
    ...updateFlags.map((flag) => `complete -c yardmaster -n "__fish_seen_subcommand_from update" -a "${flag}"`),
    ...providersSubcommands.map((command) => `complete -c yardmaster -n "__fish_seen_subcommand_from providers" -a "${command}"`),
    ...configSubcommands.map((command) => `complete -c yardmaster -n "__fish_seen_subcommand_from config" -a "${command}"`),
    ...presetsSubcommands.map((command) => `complete -c yardmaster -n "__fish_seen_subcommand_from presets" -a "${command}"`),
    ...helpTopics.map((topic) => `complete -c yardmaster -n "__fish_seen_subcommand_from help" -a "${topic}"`),
    ...shells.map((shell) => `complete -c yardmaster -n "__fish_seen_subcommand_from completion" -a "${shell}"`),
  ]

  return `${lines.join('\n')}\n`
}

export function renderCompletion(shell: CompletionShell): string {
  if (shell === 'bash') return renderBash()
  if (shell === 'zsh') return renderZsh()
  return renderFish()
}
