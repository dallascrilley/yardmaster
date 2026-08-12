import type { ConfigProviderId, ProviderOutputFormat } from '../types.js'
import type { ReviewAgentId } from '../review/command.js'

/** Global CLI flags that apply to every command (help, version, output control, verbosity). */
export type GlobalOptions = {
  help: boolean
  version: boolean
  json: boolean
  plain: boolean
  noColor: boolean
  quiet: boolean
  verbose: boolean
  noInput: boolean
}

/** Safety flags for commands that mutate configuration or state. */
export type MutationSafetyOptions = {
  dryRun: boolean
  force: boolean
}

/** Shell targets supported by the `completion` command. */
export type CompletionShell = 'bash' | 'zsh' | 'fish'

/** Options specific to `yardmaster run` and run-like commands (design, debug). */
export type RunOptions = {
  provider?: ConfigProviderId
  model?: string
  workspace?: string
  mode?: string
  trust?: boolean
  timeoutMs?: number
  noFallback: boolean
  preset?: string
  yolo?: boolean
  includeDirectories?: string[]
  outputFormat?: ProviderOutputFormat
  headless?: boolean
  extensions?: string[]
  mcp?: string[]
  promptFile?: string
  inputFile?: string
  session?: string
}

type CommitSharedOptions = Pick<
  RunOptions,
  'provider' | 'model' | 'workspace' | 'mode' | 'trust' | 'timeoutMs' | 'noFallback' | 'preset' | 'yolo'
>

/** Options for the `yardmaster commit` command — shared run options plus an apply flag. */
export type CommitOptions = CommitSharedOptions & {
  apply: boolean
}

/** Options for the `yardmaster review` command — diff source, agent selection, and output format. */
export type ReviewOptions = {
  all: boolean
  agent?: ReviewAgentId
  diffFile?: string
  staged: boolean
  base?: string
  jsonSchema: boolean
}

/** Options for `yardmaster presets set` — the preset name, overrides, and a default flag. */
export type PresetsSetOptions = {
  name: string
  provider?: ConfigProviderId
  model?: string
  mode?: string
  trust?: boolean
  yolo?: boolean
  outputFormat?: ProviderOutputFormat
  includeDirectories?: string[]
  headless?: boolean
  extensions?: string[]
  mcp?: string[]
  setDefault: boolean
}

/** Valid help topic names accepted by `yardmaster help <topic>`. */
export type HelpTopic = 'run' | 'design' | 'commit' | 'debug' | 'review' | 'update' | 'providers' | 'config' | 'presets' | 'completion'

/**
 * Discriminated union of all parsed CLI commands. Each variant carries the
 * command kind, its specific options, and the common {@link GlobalOptions}.
 */
export type ParsedCommand =
  | { kind: 'help'; topic?: HelpTopic }
  | { kind: 'version' }
  | {
      kind: 'run'
      prompt?: string
      globals: GlobalOptions
      options: RunOptions
    }
  | {
      kind: 'design'
      prompt?: string
      globals: GlobalOptions
      options: RunOptions
    }
  | {
      kind: 'providers-list'
      globals: GlobalOptions
    }
  | {
      kind: 'completion'
      globals: GlobalOptions
      shell: CompletionShell
    }
  | {
      kind: 'review'
      globals: GlobalOptions
      options: ReviewOptions
    }
  | {
      kind: 'commit'
      globals: GlobalOptions
      options: CommitOptions
    }
  | {
      kind: 'debug'
      globals: GlobalOptions
      options: RunOptions
    }
  | {
      kind: 'update'
      globals: GlobalOptions
      safety: MutationSafetyOptions
    }
  | {
      kind: 'providers-doctor'
      provider?: ConfigProviderId
      showIdentity?: boolean
      globals: GlobalOptions
    }
  | {
      kind: 'config-get'
      key?: string
      globals: GlobalOptions
    }
  | {
      kind: 'config-set'
      key: string
      value: string
      globals: GlobalOptions
      safety: MutationSafetyOptions
    }
  | {
      kind: 'config-init'
      globals: GlobalOptions
      safety: MutationSafetyOptions
    }
  | {
      kind: 'config-path'
      globals: GlobalOptions
    }
  | {
      kind: 'presets-list'
      globals: GlobalOptions
    }
  | {
      kind: 'presets-get'
      globals: GlobalOptions
      name: string
    }
  | {
      kind: 'presets-set'
      globals: GlobalOptions
      options: PresetsSetOptions
      safety: MutationSafetyOptions
    }
  | {
      kind: 'presets-delete'
      globals: GlobalOptions
      name: string
      safety: MutationSafetyOptions
    }
  | {
      kind: 'presets-use'
      globals: GlobalOptions
      name: string
      safety: MutationSafetyOptions
    }
