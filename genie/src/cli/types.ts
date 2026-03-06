import type { ProviderId, ProviderOutputFormat } from '../types.js'
import type { ReviewAgentId } from '../review/command.js'

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

export type RunOptions = {
  provider?: ProviderId
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
}

export type ReviewOptions = {
  all: boolean
  agent?: ReviewAgentId
  diffFile?: string
  staged: boolean
  base?: string
  jsonSchema: boolean
}

export type PresetsSetOptions = {
  name: string
  provider?: ProviderId
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

export type HelpTopic = 'run' | 'debug' | 'review' | 'update' | 'providers' | 'config' | 'presets'

export type ParsedCommand =
  | { kind: 'help'; topic?: HelpTopic }
  | { kind: 'version' }
  | {
      kind: 'run'
      prompt: string
      globals: GlobalOptions
      options: RunOptions
    }
  | {
      kind: 'providers-list'
      globals: GlobalOptions
    }
  | {
      kind: 'review'
      globals: GlobalOptions
      options: ReviewOptions
    }
  | {
      kind: 'debug'
      globals: GlobalOptions
      options: RunOptions
    }
  | {
      kind: 'update'
      globals: GlobalOptions
    }
  | {
      kind: 'providers-doctor'
      provider?: ProviderId
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
    }
  | {
      kind: 'config-init'
      globals: GlobalOptions
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
    }
  | {
      kind: 'presets-delete'
      globals: GlobalOptions
      name: string
    }
  | {
      kind: 'presets-use'
      globals: GlobalOptions
      name: string
    }
