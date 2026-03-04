import type { CliOutputMode, RawOutput } from '../types.js'

export type RuntimeOutput = {
  interactive: boolean
  manualOutputMode: 'json' | 'pretty'
  formatOverride: RawOutput | undefined
}

export type RuntimeState = {
  outputMode: CliOutputMode
  explicitFormat: RawOutput | undefined
  ttyAwareMode: 'json' | 'pretty'
}

export function isAgentContext(): boolean {
  return process.stdout.isTTY !== true || !!process.env.CI
}

export function parseExplicitFormat(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--json') return 'json'
    if (token === '--format' && argv[index + 1]) return argv[index + 1].toLowerCase()
    if (token.startsWith('--format=')) return token.slice('--format='.length).toLowerCase()
  }
  return undefined
}

export function resolveRuntimeState(params: {
  configOutput: CliOutputMode
  explicitOutput: CliOutputMode | undefined
  explicitFormat: string | undefined
  argv?: string[]
}): RuntimeState {
  const parsedFormat = parseExplicitFormat(params.argv ?? process.argv.slice(2))
  const format = (params.explicitFormat || parsedFormat)?.toLowerCase()
  const outputMode = params.explicitOutput ?? params.configOutput
  const ttyAwareMode = resolveOutputMode({
    agent: isAgentContext(),
    outputMode,
    explicitFormat: format,
  })

  return {
    outputMode,
    explicitFormat: format,
    ttyAwareMode,
  }
}

export function resolveOutputMode(params: {
  agent: boolean
  outputMode: CliOutputMode
  explicitFormat?: string
}): 'json' | 'pretty' {
  if (params.outputMode === 'json') return 'json'
  if (params.outputMode === 'pretty') return 'pretty'
  if ((params.explicitFormat ?? '').toLowerCase() === 'json') return 'json'
  return params.agent ? 'json' : 'pretty'
}
