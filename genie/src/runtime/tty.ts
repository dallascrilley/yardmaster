import type { CliOutputMode } from '../types.js'

export type RuntimeOutput = {
  interactive: boolean
  manualOutputMode: 'pretty' | 'json' | string
  formatOverride?: 'toon' | 'json' | 'yaml' | 'md' | string
}

export type RuntimeState = {
  outputMode: CliOutputMode
  explicitFormat: string | undefined
}

export function isAgentContext(): boolean {
  return process.stdout.isTTY !== true
}

export function parseExplicitFormat(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token) continue
    if (token === '--json') return 'json'
    if (token === '--format' && argv[i + 1]) {
      return argv[i + 1].toLowerCase()
    }
    if (token.startsWith('--format=')) {
      return token.slice('--format='.length).toLowerCase()
    }
  }
  return undefined
}

export function resolveRuntimeState(params: {
  configOutput: CliOutputMode
  explicitOutput: CliOutputMode | undefined
  explicitFormat: string | undefined
  argv?: string[]
}): RuntimeState {
  if (params.explicitOutput === 'json' || (!params.explicitOutput || params.explicitOutput === 'auto')) {
    // allow explicit --format/--json to force machine format in tty too
    const format = params.explicitFormat ?? parseExplicitFormat(params.argv ?? process.argv.slice(2))
    return {
      outputMode: params.explicitOutput === 'json' ? 'json' : 'auto',
      manualOutputMode: format === 'json' || params.explicitOutput === 'json' ? 'json' : 'pretty',
      explicitFormat: format,

type: format as any,
    }
  }

  return {
    outputMode: params.explicitOutput,
    manualOutputMode: params.explicitOutput === 'json' ? 'json' : 'pretty',
    explicitFormat: params.explicitFormat,
  }
}

export function resolveOutputMode(params: {
  agent: boolean
  outputMode: CliOutputMode
  explicitFormat?: string
}): 'json' | 'pretty' {
  if (params.explicitFormat) {
    return params.explicitFormat === 'json' ? 'json' : 'pretty'
  }

  if (params.outputMode === 'json') return 'json'
  if (params.outputMode === 'pretty') return 'pretty'
  return params.agent ? 'json' : 'pretty'
}
