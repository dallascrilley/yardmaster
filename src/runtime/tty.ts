import type { CliOutputMode } from '../types.js'

export type RuntimeState = {
  outputMode: CliOutputMode
  ttyAwareMode: 'json' | 'plain' | 'pretty'
  interactive: boolean
  colorEnabled: boolean
}

export function isInteractiveSession(forceNonInteractive = false): boolean {
  return forceNonInteractive !== true && process.stdout.isTTY === true && process.stdin.isTTY === true && process.env.CI !== 'true'
}

export function parseExplicitFormat(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--json') return 'json'
    if (token === '--plain') return 'plain'
    if (token === '--format' && argv[index + 1]) return argv[index + 1].toLowerCase()
    if (token.startsWith('--format=')) return token.slice('--format='.length).toLowerCase()
  }
  return undefined
}

export function resolveOutputMode(params: {
  interactive: boolean
  outputMode: CliOutputMode
  explicitFormat?: string
}): 'json' | 'plain' | 'pretty' {
  if (params.outputMode === 'json') return 'json'
  if (params.outputMode === 'plain') return 'plain'
  if (params.outputMode === 'pretty') return 'pretty'

  const explicitFormat = (params.explicitFormat ?? '').toLowerCase()
  if (explicitFormat === 'json') return 'json'
  if (explicitFormat === 'plain') return 'plain'

  return params.interactive ? 'pretty' : 'json'
}

export function resolveRuntimeState(params: {
  configOutput: CliOutputMode
  explicitOutput: CliOutputMode | undefined
  explicitFormat: string | undefined
  argv?: string[]
  forceNonInteractive?: boolean
  disableColor?: boolean
}): RuntimeState {
  const interactive = isInteractiveSession(params.forceNonInteractive)
  const outputMode = params.explicitOutput ?? params.configOutput
  const parsedFormat = parseExplicitFormat(params.argv ?? process.argv.slice(2))
  const explicitFormat = params.explicitFormat ?? parsedFormat

  return {
    outputMode,
    ttyAwareMode: resolveOutputMode({
      interactive,
      outputMode,
      explicitFormat,
    }),
    interactive,
    colorEnabled: params.disableColor !== true && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb',
  }
}
