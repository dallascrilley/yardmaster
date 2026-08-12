import { UsageError } from '../../../errors.js'
import type { ParsedCommand } from '../../types.js'
import { parseProvider } from '../../validate.js'
import { defaultGlobals, parseGlobalFlag } from '../shared.js'

export function parseProvidersArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  let subcommand: 'list' | 'doctor' | undefined
  let provider

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue

    if (!subcommand && (token === 'list' || token === 'doctor')) {
      subcommand = token
      continue
    }

    if (token === '--provider') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --provider')
      provider = parseProvider(value, '--provider')
      index += 1
      continue
    }

    throw new UsageError(`Unknown providers argument '${token}'`)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help || !subcommand) return { kind: 'help', topic: 'providers' }

  if (subcommand === 'list') {
    if (provider) {
      throw new UsageError('--provider is not supported with providers list')
    }
    return {
      kind: 'providers-list',
      globals,
    }
  }

  return {
    kind: 'providers-doctor',
    provider,
    globals,
  }
}
