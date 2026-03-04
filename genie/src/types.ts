import { z } from 'dc-cli-kit'

export const providerIds = ['claude', 'codex', 'cursor-agent', 'gemini'] as const

export type ProviderId = (typeof providerIds)[number]

export const cliOutputModeSchema = z.enum(['auto', 'pretty', 'json'])
export type CliOutputMode = z.infer<typeof cliOutputModeSchema>

export type ProviderInvocation = {
  command: string
  args: string[]
  cwd?: string
}

export type CommandResult = {
  stdout: string
  stderr: string
  code: number
}

export type CommandRunner = (invocation: ProviderInvocation) => Promise<CommandResult>

export type ProviderCheckResult =
  | { ok: true }
  | { ok: false; reason: string; hint?: string }

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
}

export type ProviderFailureReason = {
  provider: ProviderId
  stage: 'availability' | 'auth' | 'execution'
  reason: string
  hint?: string
}

export type GenieResponse = {
  provider: ProviderId
  model: string | undefined
  mode: string
  workspace: string
  trust: boolean
  response: string
  raw: CommandResult
  fallbackUsed: boolean
}

export interface ProviderAdapter {
  id: ProviderId
  isAvailable(runner?: CommandRunner): Promise<ProviderCheckResult>
  isAuthenticated(runner?: CommandRunner): Promise<ProviderCheckResult>
  buildInvocation(request: NormalizedRequest): ProviderInvocation
  execute(request: NormalizedRequest, runner?: CommandRunner): Promise<ProviderParseResult>
  parse(result: CommandResult): ProviderParseResult
}
