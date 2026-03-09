import { UsageError } from '../../../errors.js'
import type { ParsedCommand, PresetsSetOptions } from '../../types.js'
import { parseListValue, parseMode, parseOutputFormat, parseProvider } from '../../validate.js'
import { defaultGlobals, defaultMutationSafety, parseGlobalFlag, parseMutationFlag } from '../shared.js'

export function parsePresetsArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const safety = defaultMutationSafety()
  let subcommand: 'list' | 'get' | 'set' | 'delete' | 'use' | undefined
  const positional: string[] = []
  const setOptions: Omit<PresetsSetOptions, 'name'> = { setDefault: false }

  const setOnlyFlagNames = ['--provider', '--model', '--mode', '--output-format', '--include-directories', '--extensions', '--mcp', '--trust', '--yolo', '--print', '--default']
  const seenSetOnlyFlags: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue

    if (!subcommand && (token === 'list' || token === 'get' || token === 'set' || token === 'delete' || token === 'use')) {
      subcommand = token
      continue
    }

    if (subcommand && (subcommand === 'set' || subcommand === 'delete' || subcommand === 'use') && parseMutationFlag(token, safety)) {
      continue
    }

    const isSetOnlyFlag = setOnlyFlagNames.includes(token)
    if (isSetOnlyFlag && subcommand && subcommand !== 'set') {
      throw new UsageError(`'${token}' is only valid with 'presets set'`)
    }
    if (isSetOnlyFlag) {
      seenSetOnlyFlags.push(token)
    }

    if (token === '--provider') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --provider')
      setOptions.provider = parseProvider(value, '--provider')
      index += 1
      continue
    }
    if (token === '--model') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --model')
      setOptions.model = value
      index += 1
      continue
    }
    if (token === '--mode') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --mode')
      setOptions.mode = parseMode(value, '--mode')
      index += 1
      continue
    }
    if (token === '--output-format') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --output-format')
      setOptions.outputFormat = parseOutputFormat(value, '--output-format')
      index += 1
      continue
    }
    if (token === '--include-directories') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --include-directories')
      setOptions.includeDirectories = [...(setOptions.includeDirectories ?? []), ...parseListValue(value)]
      index += 1
      continue
    }
    if (token === '--extensions') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --extensions')
      setOptions.extensions = [...(setOptions.extensions ?? []), ...parseListValue(value)]
      index += 1
      continue
    }
    if (token === '--mcp') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --mcp')
      setOptions.mcp = [...(setOptions.mcp ?? []), ...parseListValue(value)]
      index += 1
      continue
    }
    if (token === '--trust') {
      setOptions.trust = true
      continue
    }
    if (token === '--yolo') {
      setOptions.yolo = true
      continue
    }
    if (token === '--print') {
      setOptions.headless = true
      continue
    }
    if (token === '--default') {
      setOptions.setDefault = true
      continue
    }

    if (token.startsWith('-')) {
      throw new UsageError(`Unknown presets argument '${token}'`)
    }

    positional.push(token)
  }

  // Post-loop: reject set-only flags that appeared before the subcommand was known
  if (seenSetOnlyFlags.length > 0 && subcommand && subcommand !== 'set') {
    throw new UsageError(`'${seenSetOnlyFlags[0]}' is only valid with 'presets set'`)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help || !subcommand) return { kind: 'help', topic: 'presets' }

  if (subcommand === 'list') {
    return {
      kind: 'presets-list',
      globals,
    }
  }

  const name = positional[0]?.trim()
  if (!name) {
    throw new UsageError(`Usage: genie presets ${subcommand} <name>`)
  }

  if (subcommand === 'get') {
    return {
      kind: 'presets-get',
      globals,
      name,
    }
  }

  if (subcommand === 'delete') {
    return {
      kind: 'presets-delete',
      globals,
      name,
      safety,
    }
  }

  if (subcommand === 'use') {
    return {
      kind: 'presets-use',
      globals,
      name,
      safety,
    }
  }

  return {
    kind: 'presets-set',
    globals,
    safety,
    options: {
      name,
      ...setOptions,
    },
  }
}
