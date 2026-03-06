import { UsageError } from '../errors.js'
import { isConfigKey } from '../config/commands.js'
import { parseReviewAgent } from '../review/command.js'
import type { CommitOptions, HelpTopic, ParsedCommand, PresetsSetOptions, ReviewOptions, RunOptions, GlobalOptions } from './types.js'
import {
  isStrictCommandsEnabled,
  parseListValue,
  parseMode,
  parseOutputFormat,
  parseProvider,
} from './validate.js'

const aliasCommands = new Set(['wish', 'rub'])

function defaultGlobals(): GlobalOptions {
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

function parseGlobalFlag(token: string, globals: GlobalOptions): boolean {
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

function parseReviewArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const options: ReviewOptions = { all: false, staged: false, jsonSchema: false }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue
    if (token === '--all') {
      options.all = true
      continue
    }
    if (token === '--agent') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --agent')
      options.agent = parseReviewAgent(value)
      index += 1
      continue
    }
    if (token === '--diff-file') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --diff-file')
      options.diffFile = value
      index += 1
      continue
    }
    if (token === '--staged') {
      options.staged = true
      continue
    }
    if (token === '--base') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --base')
      options.base = value.trim()
      index += 1
      continue
    }
    if (token === '--json-schema') {
      options.jsonSchema = true
      continue
    }
    throw new UsageError(`Unknown review argument '${token}'`)
  }

  if (options.staged && options.diffFile) {
    throw new UsageError('--staged cannot be used with --diff-file')
  }
  if (options.base && options.diffFile) {
    throw new UsageError('--base cannot be used with --diff-file')
  }
  if (options.base && options.staged) {
    throw new UsageError('--base cannot be used with --staged')
  }
  if (options.jsonSchema && (options.all || options.agent || options.diffFile || options.staged || options.base)) {
    throw new UsageError('--json-schema cannot be combined with review target or diff-source flags')
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help) return { kind: 'help', topic: 'review' }
  return {
    kind: 'review',
    globals,
    options,
  }
}

function parseUpdateArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()

  for (const token of tokens) {
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue
    throw new UsageError(`Unknown update argument '${token}'`)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help) return { kind: 'help', topic: 'update' }
  return {
    kind: 'update',
    globals,
  }
}

function parseRunLikeArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const options: RunOptions = { noFallback: false }
  const positional: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue

    if (token === '--provider' || token === '-p') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.provider = parseProvider(value, token)
      index += 1
      continue
    }

    if (token === '--model' || token === '-m') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.model = value
      index += 1
      continue
    }

    if (token === '--workspace' || token === '-w') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.workspace = value
      index += 1
      continue
    }

    if (token === '--mode') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.mode = parseMode(value, token)
      index += 1
      continue
    }

    if (token === '--preset') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --preset')
      options.preset = value.trim()
      index += 1
      continue
    }

    if (token === '--output-format') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --output-format')
      options.outputFormat = parseOutputFormat(value, '--output-format')
      index += 1
      continue
    }

    if (token === '--include-directories') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --include-directories')
      options.includeDirectories = [...(options.includeDirectories ?? []), ...parseListValue(value)]
      index += 1
      continue
    }

    if (token === '--extensions') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --extensions')
      options.extensions = [...(options.extensions ?? []), ...parseListValue(value)]
      index += 1
      continue
    }

    if (token === '--mcp') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --mcp')
      options.mcp = [...(options.mcp ?? []), ...parseListValue(value)]
      index += 1
      continue
    }

    if (token === '--timeout-ms') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --timeout-ms')
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new UsageError('Invalid value for --timeout-ms')
      }
      options.timeoutMs = Math.floor(parsed)
      index += 1
      continue
    }

    if (token === '--trust') {
      options.trust = true
      continue
    }

    if (token === '--yolo') {
      options.yolo = true
      continue
    }

    if (token === '--print') {
      options.headless = true
      continue
    }

    if (token === '--no-fallback') {
      options.noFallback = true
      continue
    }

    if (token.startsWith('-')) {
      throw new UsageError(`Unknown option '${token}'`)
    }

    positional.push(token)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help) return { kind: 'help', topic: 'run' }

  const prompt = positional.join(' ').trim()
  if (!prompt) {
    throw new UsageError('Prompt is required')
  }

  return {
    kind: 'run',
    prompt,
    globals,
    options,
  }
}

function parseDebugArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const options: RunOptions = { noFallback: false }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue

    if (token === '--provider' || token === '-p') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.provider = parseProvider(value, token)
      index += 1
      continue
    }

    if (token === '--model' || token === '-m') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.model = value
      index += 1
      continue
    }

    if (token === '--workspace' || token === '-w') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.workspace = value
      index += 1
      continue
    }

    if (token === '--mode') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.mode = parseMode(value, token)
      index += 1
      continue
    }

    if (token === '--preset') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --preset')
      options.preset = value.trim()
      index += 1
      continue
    }

    if (token === '--timeout-ms') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --timeout-ms')
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new UsageError('Invalid value for --timeout-ms')
      }
      options.timeoutMs = Math.floor(parsed)
      index += 1
      continue
    }

    if (token === '--trust') {
      options.trust = true
      continue
    }

    if (token === '--yolo') {
      options.yolo = true
      continue
    }

    if (token === '--no-fallback') {
      options.noFallback = true
      continue
    }

    if (token.startsWith('-')) {
      throw new UsageError(`Unknown debug argument '${token}'`)
    }

    throw new UsageError(`Unexpected positional argument '${token}'. Pipe terminal output into genie debug instead.`)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.json) {
    throw new UsageError('--json is not supported for genie debug')
  }
  if (globals.help) return { kind: 'help', topic: 'debug' }

  return {
    kind: 'debug',
    globals,
    options,
  }
}

function parseCommitArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const options: CommitOptions = { noFallback: false, apply: false }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue

    if (token === '--provider' || token === '-p') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.provider = parseProvider(value, token)
      index += 1
      continue
    }

    if (token === '--model' || token === '-m') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.model = value
      index += 1
      continue
    }

    if (token === '--workspace' || token === '-w') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.workspace = value
      index += 1
      continue
    }

    if (token === '--mode') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError(`Missing value for ${token}`)
      options.mode = parseMode(value, token)
      index += 1
      continue
    }

    if (token === '--preset') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --preset')
      options.preset = value.trim()
      index += 1
      continue
    }

    if (token === '--timeout-ms') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --timeout-ms')
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new UsageError('Invalid value for --timeout-ms')
      }
      options.timeoutMs = Math.floor(parsed)
      index += 1
      continue
    }

    if (token === '--trust') {
      options.trust = true
      continue
    }

    if (token === '--yolo') {
      options.yolo = true
      continue
    }

    if (token === '--no-fallback') {
      options.noFallback = true
      continue
    }

    if (token === '--apply' || token === '-a') {
      options.apply = true
      continue
    }

    if (token.startsWith('-')) {
      throw new UsageError(`Unknown commit argument '${token}'`)
    }

    throw new UsageError(`Unexpected positional argument '${token}'. genie commit reads staged git changes directly.`)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.json) {
    throw new UsageError('--json is not supported for genie commit')
  }
  if (globals.help) return { kind: 'help', topic: 'commit' }

  return {
    kind: 'commit',
    globals,
    options,
  }
}

function parseProvidersArgs(tokens: string[]): ParsedCommand {
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

function parsePresetsArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  let subcommand: 'list' | 'get' | 'set' | 'delete' | 'use' | undefined
  const positional: string[] = []
  const setOptions: Omit<PresetsSetOptions, 'name'> = { setDefault: false }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue

    if (!subcommand && (token === 'list' || token === 'get' || token === 'set' || token === 'delete' || token === 'use')) {
      subcommand = token
      continue
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

    positional.push(token)
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
    }
  }

  if (subcommand === 'use') {
    return {
      kind: 'presets-use',
      globals,
      name,
    }
  }

  return {
    kind: 'presets-set',
    globals,
    options: {
      name,
      ...setOptions,
    },
  }
}

function parseConfigArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
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
    }
  }

  if (subcommand === 'init') {
    if (positional.length > 0) {
      throw new UsageError('Usage: genie config init')
    }

    return {
      kind: 'config-init',
      globals,
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

export function parseArgv(argv: string[]): ParsedCommand {
  const tokens = [...argv]
  if (tokens.length === 0) {
    return {
      kind: 'help',
    }
  }

  const first = tokens[0]

  if (first === '--help' || first === '-h') {
    return { kind: 'help' }
  }

  if (first === '--version') {
    return { kind: 'version' }
  }

  const helpTopicSet = new Set<HelpTopic>(['run', 'commit', 'debug', 'review', 'update', 'providers', 'config', 'presets'])
  const globalFlagSet = new Set([
    '--help',
    '-h',
    '--json',
    '--plain',
    '--no-color',
    '--no-input',
    '--quiet',
    '-q',
    '--verbose',
    '-v',
    '--version',
  ])
  const positional: string[] = []
  for (const token of tokens) {
    if (globalFlagSet.has(token)) continue
    positional.push(token)
  }

  if (positional[0] === 'help') {
    const topic = positional[1]
    if (!topic) {
      return { kind: 'help' }
    }
    if (helpTopicSet.has(topic as HelpTopic)) {
      if (positional.length > 2) {
        throw new UsageError(`Unknown help topic '${positional[2]}'`)
      }
      return { kind: 'help', topic: topic as HelpTopic }
    }
    throw new UsageError(`Unknown help topic '${topic}'`)
  }

  const cmd = positional[0]
  if (cmd && aliasCommands.has(cmd)) {
    const index = tokens.indexOf(cmd)
    const runTokens = [...tokens.slice(0, index), ...tokens.slice(index + 1)]
    return parseRunLikeArgs(runTokens)
  }

  if (first === 'run') {
    return parseRunLikeArgs(tokens.slice(1))
  }
  if (first === 'commit') {
    return parseCommitArgs(tokens.slice(1))
  }
  if (first === 'debug') {
    return parseDebugArgs(tokens.slice(1))
  }
  if (first === 'review') {
    return parseReviewArgs(tokens.slice(1))
  }
  if (first === 'update') {
    return parseUpdateArgs(tokens.slice(1))
  }

  if (first === 'providers') {
    return parseProvidersArgs(tokens.slice(1))
  }

  if (first === 'presets') {
    return parsePresetsArgs(tokens.slice(1))
  }

  if (first === 'config') {
    return parseConfigArgs(tokens.slice(1))
  }

  const strictToken = positional[0]
  if (isStrictCommandsEnabled() && strictToken) {
    throw new UsageError(`Unknown command '${strictToken}'. Use 'genie help' for usage.`)
  }

  return parseRunLikeArgs(tokens)
}
