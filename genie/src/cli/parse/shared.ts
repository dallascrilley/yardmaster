import type { GlobalOptions } from '../types.js'

export type MutationSafetyOptions = {
  dryRun: boolean
  force: boolean
}

export const aliasCommands = new Set(['wish', 'rub'])
export const rootCommands = new Set(['run', 'design', 'commit', 'debug', 'review', 'update', 'providers', 'presets', 'config', 'help', 'completion'])
export const strictCommandNames = [...rootCommands, ...aliasCommands]

export function defaultGlobals(): GlobalOptions {
  return {
    help: false,
    version: false,
    json: false,
    plain: false,
    noColor: false,
    quiet: false,
    verbose: false,
    noInput: false,
  }
}

export function parseGlobalFlag(token: string, globals: GlobalOptions): boolean {
  if (token === '--help' || token === '-h') {
    globals.help = true
    return true
  }
  if (token === '--version') {
    globals.version = true
    return true
  }
  if (token === '--json') {
    globals.json = true
    return true
  }
  if (token === '--plain') {
    globals.plain = true
    return true
  }
  if (token === '--no-color') {
    globals.noColor = true
    return true
  }
  if (token === '--no-input') {
    globals.noInput = true
    return true
  }
  if (token === '--quiet' || token === '-q') {
    globals.quiet = true
    return true
  }
  if (token === '--verbose' || token === '-v') {
    globals.verbose = true
    return true
  }
  return false
}

export function defaultMutationSafety(): MutationSafetyOptions {
  return {
    dryRun: false,
    force: false,
  }
}

export function parseMutationFlag(token: string, safety: MutationSafetyOptions): boolean {
  if (token === '--dry-run') {
    safety.dryRun = true
    return true
  }
  if (token === '--force') {
    safety.force = true
    return true
  }
  return false
}

export function shouldPreservePromptShorthand(positional: string[]): boolean {
  if (positional.length === 0) return false
  if (positional[0]?.includes(' ')) return true
  return positional.length > 1 && positional.slice(1).every((token) => !token.startsWith('-'))
}

export function looksLikeMistypedRootCommand(token: string): boolean {
  const normalized = token.trim().toLowerCase()
  if (!normalized || normalized.startsWith('-')) return false
  return strictCommandNames.some((command) => boundedEditDistance(normalized, command, 2) <= 2)
}

function boundedEditDistance(left: string, right: string, maxDistance: number): number {
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 0; row < left.length; row += 1) {
    const current = [row + 1]
    let rowMin = current[0]

    for (let column = 0; column < right.length; column += 1) {
      const substitutionCost = left[row] === right[column] ? 0 : 1
      const value = Math.min(previous[column + 1] + 1, current[column] + 1, previous[column] + substitutionCost)
      current.push(value)
      rowMin = Math.min(rowMin, value)
    }

    if (rowMin > maxDistance) return maxDistance + 1
    previous = current
  }

  return previous[right.length] ?? maxDistance + 1
}
