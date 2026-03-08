import { UsageError } from '../../../errors.js'
import { isConfigKey } from '../../../config/commands.js'
import type { ParsedCommand } from '../../types.js'
import { defaultGlobals, defaultMutationSafety, parseGlobalFlag, parseMutationFlag } from '../shared.js'

export function parseConfigArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const safety = defaultMutationSafety()
  let subcommand: 'get' | 'set' | 'init' | 'path' | undefined
  const positional: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue

    if (!subcommand && (token === 'get' || token === 'set' || token === 'init' || token === 'path')) {
      subcommand = token
      continue
    }

    if (subcommand && (subcommand === 'set' || subcommand === 'init') && parseMutationFlag(token, safety)) {
      continue
    }

    if (token.startsWith('-')) {
      throw new UsageError(`Unknown config argument '${token}'`)
    }

    positional.push(token)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help || !subcommand) return { kind: 'help', topic: 'config' }

  if (subcommand === 'get') {
    if (positional[0] && !isConfigKey(positional[0])) {
      throw new UsageError(`Unknown config key '${positional[0]}'`)
    }

    return {
      kind: 'config-get',
      key: positional[0],
      globals,
    }
  }

  if (subcommand === 'set') {
    if (positional.length < 2) {
      throw new UsageError('Usage: genie config set <key> <value>')
    }
    const key = positional[0]
    if (!key) {
      throw new UsageError('Usage: genie config set <key> <value>')
    }

    return {
      kind: 'config-set',
      key,
      value: positional.slice(1).join(' '),
      globals,
      safety,
    }
  }

  if (subcommand === 'init') {
    if (positional.length > 0) {
      throw new UsageError('Usage: genie config init')
    }

    return {
      kind: 'config-init',
      globals,
      safety,
    }
  }

  if (positional.length > 0) {
    throw new UsageError('Usage: genie config path [--json]')
  }

  return {
    kind: 'config-path',
    globals,
  }
}
