import { z } from 'zod'

export const providerIds = ['claude', 'codex', 'cursor-agent', 'gemini'] as const
export const modeIds = ['default', 'read-only', 'danger-full-access', 'ask', 'plan', 'freeform'] as const

export type ProviderId = (typeof providerIds)[number]
export type ModeId = (typeof modeIds)[number]

export const cliOutputModeSchema = z.enum(['auto', 'pretty', 'json', 'plain'])
export type CliOutputMode = z.infer<typeof cliOutputModeSchema>

export type CliFormat = 'json' | 'pretty' | 'plain'
export type ProviderOutputFormat = 'text' | 'json' | 'stream-json'

export type ProviderPreset = {
  provider?: ProviderId
  model?: string
  mode?: string
  trust?: boolean
  yolo?: boolean
  headless?: boolean
  includeDirectories?: string[]
  outputFormat?: ProviderOutputFormat
  extensions?: string[]
  mcp?: string[]
}

export type RequestInput = {
  prompt: string
  provider?: string
  model?: string
  workspace?: string
  mode?: string
  trust?: boolean
  output?: CliOutputMode
  timeoutMs?: number
  noFallback?: boolean
  yolo?: boolean
  includeDirectories?: string[]
  outputFormat?: ProviderOutputFormat
  headless?: boolean
  extensions?: string[]
  mcp?: string[]
}

export type ProviderInvocation = {
  command: string
  args: string[]
  cwd?: string
  timeoutMs?: number
}

export type CommandResult = {
  stdout: string
  stderr: string
  code: number
}

export type CommandRunner = (invocation: ProviderInvocation) => Promise<CommandResult>

export type ProviderCheckResult =
  | {
      ok: true
      details?: string
    }
  | {
      ok: false
      reason: string
      hint?: string
      code?: number
      details?: string
      authFailure?: boolean
      timeout?: boolean
    }

export type ProviderParseResult = {
  text: string
  raw: CommandResult
}

export type NormalizedRequest = {
  prompt: string
  provider?: ProviderId
  model?: string
  workspace: string
  mode: string
  trust: boolean
  output: CliOutputMode
  timeoutMs: number
  noFallback: boolean
  yolo: boolean
  includeDirectories: string[]
  outputFormat: ProviderOutputFormat
  headless: boolean
  extensions: string[]
  mcp: string[]
}

export type ProviderFailureStage = 'availability' | 'auth' | 'execution'

export type ProviderFailureReason = {
  provider: ProviderId
  stage: ProviderFailureStage
  reason: string
  hint?: string
  durationMs?: number
  authFailure?: boolean
  timeout?: boolean
}

export type GenieRunResult = {
  provider: ProviderId
  model: string | undefined
  mode: string
  workspace: string
  trust: boolean
  response: string
  raw: CommandResult
  fallbackUsed: boolean
  timings: {
    totalMs: number
    attempts: Array<{
      provider: ProviderId
      stage: ProviderFailureStage | 'success'
      durationMs: number
      ok: boolean
      reason?: string
    }>
  }
}

export type GenieResponseEnvelope = {
  provider: ProviderId | null
  model: string | null
  response: string
  fallbackUsed: boolean
  timings: {
    totalMs: number
    attempts: Array<{
      provider: ProviderId
      stage: ProviderFailureStage | 'success'
      durationMs: number
      ok: boolean
      reason?: string
    }>
  }
  error: {
    code: string
    message: string
  } | null
}

export interface ProviderAdapter {
  id: ProviderId
  isAvailable(runner?: CommandRunner): Promise<ProviderCheckResult>
  isAuthenticated(runner?: CommandRunner): Promise<ProviderCheckResult>
  buildInvocation(request: NormalizedRequest): ProviderInvocation
  execute(request: NormalizedRequest, runner?: CommandRunner): Promise<ProviderParseResult>
  parse(result: CommandResult): ProviderParseResult
}
