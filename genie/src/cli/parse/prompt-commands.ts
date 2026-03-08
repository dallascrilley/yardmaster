import { UsageError } from '../../errors.js'
import type {
  CommitOptions,
  ParsedCommand,
  RunOptions,
} from '../types.js'
import {
  parseListValue,
  parseMode,
  parseOutputFormat,
  parseProvider,
} from '../validate.js'
import { defaultGlobals, parseGlobalFlag } from './shared.js'

function parsePromptCommandArgs(tokens: string[], kind: 'run' | 'design'): ParsedCommand {
  const globals = defaultGlobals()
  const options: RunOptions = { noFallback: false }
  const positional: string[] = []
  const allowExtendedOptions = kind === 'run'

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

    if (token === '--prompt-file') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --prompt-file')
      options.promptFile = value
      index += 1
      continue
    }

    if (allowExtendedOptions && token === '--output-format') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --output-format')
      options.outputFormat = parseOutputFormat(value, '--output-format')
      index += 1
      continue
    }

    if (allowExtendedOptions && token === '--include-directories') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --include-directories')
      options.includeDirectories = [...(options.includeDirectories ?? []), ...parseListValue(value)]
      index += 1
      continue
    }

    if (allowExtendedOptions && token === '--extensions') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --extensions')
      options.extensions = [...(options.extensions ?? []), ...parseListValue(value)]
      index += 1
      continue
    }

    if (allowExtendedOptions && token === '--mcp') {
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

    if (allowExtendedOptions && token === '--print') {
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
  if (globals.help) return { kind: 'help', topic: kind }

  const prompt = positional.join(' ').trim()
  if (prompt && options.promptFile) {
    throw new UsageError('--prompt-file cannot be used with positional prompt text')
  }
  if (!prompt && !options.promptFile) {
    throw new UsageError('Prompt is required')
  }

  return {
    kind,
    prompt: prompt || undefined,
    globals,
    options,
  }
}

export function parseRunLikeArgs(tokens: string[]): ParsedCommand {
  return parsePromptCommandArgs(tokens, 'run')
}

export function parseDesignArgs(tokens: string[]): ParsedCommand {
  return parsePromptCommandArgs(tokens, 'design')
}

export function parseDebugArgs(tokens: string[]): ParsedCommand {
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

    if (token === '--input-file') {
      const value = tokens[index + 1]
      if (!value) throw new UsageError('Missing value for --input-file')
      options.inputFile = value
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
  if (globals.help) return { kind: 'help', topic: 'debug' }

  return {
    kind: 'debug',
    globals,
    options,
  }
}

export function parseCommitArgs(tokens: string[]): ParsedCommand {
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
