import { readFileSync } from 'node:fs'

import {
  AggregatedProviderError,
  getExitCode,
  UsageError,
} from './errors.js'
import {
  configGet,
  configInit,
  configPath,
  configSet,
  isConfigKey,
} from './config/commands.js'
import { loadConfig } from './config/store.js'
import { modeIds, providerIds, type CliOutputMode, type ProviderFailureReason, type ProviderId, type ProviderPreset, type ProviderOutputFormat } from './types.js'
import { resolveWorkspacePath } from './runtime/workspace.js'
import { resolveRuntimeState } from './runtime/tty.js'
import { executeReviewCommand, formatReviewReport, parseReviewAgent, type ReviewAgentId } from './review/command.js'
import {
  runRequest,
  toErrorEnvelope,
  toResponseEnvelope,
  type RunRequestInput,
} from './execution/run-request.js'
import { doctorProviders, listProviders } from './providers/doctor.js'
import { deletePreset, getPreset, listPresets, setPreset, usePreset } from './presets/commands.js'

type GlobalOptions = {
  help: boolean
  version: boolean
  json: boolean
  plain: boolean
  noColor: boolean
  quiet: boolean
  verbose: boolean
  noInput: boolean
}

type RunOptions = {
  provider?: ProviderId
  model?: string
  workspace?: string
  mode?: string
  trust?: boolean
  timeoutMs?: number
  noFallback: boolean
  preset?: string
  yolo?: boolean
  includeDirectories?: string[]
  outputFormat?: ProviderOutputFormat
  headless?: boolean
  extensions?: string[]
  mcp?: string[]
}

type ReviewOptions = {
  all: boolean
  agent?: ReviewAgentId
  diffFile?: string
}

type PresetsSetOptions = {
  name: string
  provider?: ProviderId
  model?: string
  mode?: string
  trust?: boolean
  yolo?: boolean
  outputFormat?: ProviderOutputFormat
  includeDirectories?: string[]
  headless?: boolean
  extensions?: string[]
  mcp?: string[]
  setDefault: boolean
}

type ParsedCommand =
  | { kind: 'help'; topic?: 'run' | 'review' | 'providers' | 'config' | 'presets' }
  | { kind: 'version' }
  | {
      kind: 'run'
      prompt: string
      globals: GlobalOptions
      options: RunOptions
    }
  | {
      kind: 'providers-list'
      globals: GlobalOptions
    }
  | {
      kind: 'review'
      globals: GlobalOptions
      options: ReviewOptions
    }
  | {
      kind: 'providers-doctor'
      provider?: ProviderId
      globals: GlobalOptions
    }
  | {
      kind: 'config-get'
      key?: string
      globals: GlobalOptions
    }
  | {
      kind: 'config-set'
      key: string
      value: string
      globals: GlobalOptions
    }
  | {
      kind: 'config-init'
      globals: GlobalOptions
    }
  | {
      kind: 'config-path'
      globals: GlobalOptions
    }
  | {
      kind: 'presets-list'
      globals: GlobalOptions
    }
  | {
      kind: 'presets-get'
      globals: GlobalOptions
      name: string
    }
  | {
      kind: 'presets-set'
      globals: GlobalOptions
      options: PresetsSetOptions
    }
  | {
      kind: 'presets-delete'
      globals: GlobalOptions
      name: string
    }
  | {
      kind: 'presets-use'
      globals: GlobalOptions
      name: string
    }

const aliasCommands = new Set(['wish', 'rub'])

function readPackageVersion(): string {
  try {
    const pkgPath = new URL('../package.json', import.meta.url)
    const raw = readFileSync(pkgPath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

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

function usage(topic?: ParsedCommand['kind'] | 'run' | 'review' | 'providers' | 'config' | 'presets'): string {
  const root = [
    'Usage:',
    '  genie <prompt>',
    '  genie run [options] <prompt>',
    '  genie review [--all | --agent <id>] [--diff-file <path>] [--json]',
    '  genie providers list [--json]',
    '  genie providers doctor [--provider <id>] [--json]',
    '  genie config get [key] [--json]',
    '  genie config set <key> <value>',
    '  genie config init',
    '  genie config path [--json]',
    '  genie presets list [--json]',
    '  genie presets get <name> [--json]',
    '  genie presets set <name> [options]',
    '  genie presets delete <name>',
    '  genie presets use <name>',
    '',
    'Global flags:',
    '  -h, --help',
    '  --version',
    '  --json',
    '  --plain',
    '  --no-color',
    '  -q, --quiet',
    '  -v, --verbose',
    '  --no-input',
    '',
    `Providers: ${providerIds.join(', ')}`,
  ]

  const run = [
    'Usage: genie run [options] <prompt>',
    '  -p, --provider <claude|codex|cursor-agent|gemini>',
    '  -m, --model <name>',
    '  -w, --workspace <path>',
    '  --mode <name>',
    '  --trust',
    '  --preset <name>',
    '  --yolo',
    '  --include-directories <a,b,c>',
    '  --output-format <text|json|stream-json>',
    '  --print',
    '  --extensions <a,b,c>',
    '  --mcp <a,b,c>',
    '  --timeout-ms <n>',
    '  --no-fallback',
  ]

  const review = [
    'Usage: genie review [--all | --agent <codex|claude|gemini|cursor>] [--diff-file <path>]',
    '  --all',
    '  --agent <id>',
    '  --diff-file <path>',
  ]

  const providers = [
    'Usage: genie providers <subcommand>',
    'Subcommands:',
    '  list [--json]',
    '  doctor [--provider <id>] [--json]',
  ]

  const config = [
    'Usage: genie config <subcommand>',
    'Subcommands:',
    '  get [key] [--json]',
    '  set <key> <value>',
    '  init',
    '  path [--json]',
  ]

  const presets = [
    'Usage: genie presets <subcommand>',
    'Subcommands:',
    '  list [--json]',
    '  get <name> [--json]',
    '  set <name> [--provider <id>] [--model <name>] [--mode <name>] [--trust] [--yolo] [--print]',
    '      [--include-directories <a,b,c>] [--output-format <text|json|stream-json>] [--extensions <a,b,c>] [--mcp <a,b,c>] [--default]',
    '  delete <name>',
    '  use <name>',
  ]

  if (topic === 'run') return run.join('\n')
  if (topic === 'review') return review.join('\n')
  if (topic === 'providers') return providers.join('\n')
  if (topic === 'config') return config.join('\n')
  if (topic === 'presets') return presets.join('\n')
  return root.join('\n')
}

function parseReviewArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const options: ReviewOptions = { all: false }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue

    if (token === '--help' || token === '-h') {
      globals.help = true
      continue
    }
    if (token === '--version') {
      globals.version = true
      continue
    }
    if (token === '--json') {
      globals.json = true
      continue
    }
    if (token === '--plain') {
      globals.plain = true
      continue
    }
    if (token === '--no-color') {
      globals.noColor = true
      continue
    }
    if (token === '--no-input') {
      globals.noInput = true
      continue
    }
    if (token === '--quiet' || token === '-q') {
      globals.quiet = true
      continue
    }
    if (token === '--verbose' || token === '-v') {
      globals.verbose = true
      continue
    }
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
    throw new UsageError(`Unknown review argument '${token}'`)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help) return { kind: 'help', topic: 'review' }
  return {
    kind: 'review',
    globals,
    options,
  }
}

function parseProvider(value: string, flag: string): ProviderId {
  if (!providerIds.includes(value as ProviderId)) {
    throw new UsageError(`Unknown provider '${value}' for ${flag}`)
  }
  return value as ProviderId
}

function parseOutputFormat(value: string, flag: string): ProviderOutputFormat {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'text' || normalized === 'json' || normalized === 'stream-json') {
    return normalized
  }
  throw new UsageError(`Unknown output format '${value}' for ${flag}`)
}

function parseMode(value: string, flag: string): (typeof modeIds)[number] {
  const normalized = value.trim()
  if (!modeIds.includes(normalized as (typeof modeIds)[number])) {
    throw new UsageError(`Unknown mode '${value}' for ${flag}. Expected one of: ${modeIds.join(', ')}`)
  }
  return normalized as (typeof modeIds)[number]
}

function isStrictCommandsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.GENIE_STRICT_COMMANDS?.trim().toLowerCase()
  if (!value) return false
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function parseListValue(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function mergeRunOptionsWithPreset(options: RunOptions, preset?: ProviderPreset): RunOptions {
  if (!preset) {
    return options
  }

  return {
    ...options,
    provider: options.provider ?? preset.provider,
    model: options.model ?? preset.model,
    mode: options.mode ?? preset.mode,
    trust: options.trust ?? preset.trust,
    yolo: options.yolo ?? preset.yolo,
    outputFormat: options.outputFormat ?? preset.outputFormat,
    includeDirectories: options.includeDirectories ?? preset.includeDirectories,
    headless: options.headless ?? preset.headless,
    extensions: options.extensions ?? preset.extensions,
    mcp: options.mcp ?? preset.mcp,
  }
}

function parseRunLikeArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const options: RunOptions = { noFallback: false }
  const positional: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue

    if (token === '--help' || token === '-h') {
      globals.help = true
      continue
    }
    if (token === '--version') {
      globals.version = true
      continue
    }
    if (token === '--json') {
      globals.json = true
      continue
    }
    if (token === '--plain') {
      globals.plain = true
      continue
    }
    if (token === '--no-color') {
      globals.noColor = true
      continue
    }
    if (token === '--no-input') {
      globals.noInput = true
      continue
    }
    if (token === '--quiet' || token === '-q') {
      globals.quiet = true
      continue
    }
    if (token === '--verbose' || token === '-v') {
      globals.verbose = true
      continue
    }

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

function parseProvidersArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  let subcommand: 'list' | 'doctor' | undefined
  let provider: ProviderId | undefined

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue

    if (token === '--help' || token === '-h') {
      globals.help = true
      continue
    }
    if (token === '--version') {
      globals.version = true
      continue
    }
    if (token === '--json') {
      globals.json = true
      continue
    }
    if (token === '--plain') {
      globals.plain = true
      continue
    }
    if (token === '--no-color') {
      globals.noColor = true
      continue
    }
    if (token === '--no-input') {
      globals.noInput = true
      continue
    }
    if (token === '--quiet' || token === '-q') {
      globals.quiet = true
      continue
    }
    if (token === '--verbose' || token === '-v') {
      globals.verbose = true
      continue
    }

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

    if (token === '--help' || token === '-h') {
      globals.help = true
      continue
    }
    if (token === '--version') {
      globals.version = true
      continue
    }
    if (token === '--json') {
      globals.json = true
      continue
    }
    if (token === '--plain') {
      globals.plain = true
      continue
    }
    if (token === '--no-color') {
      globals.noColor = true
      continue
    }
    if (token === '--no-input') {
      globals.noInput = true
      continue
    }
    if (token === '--quiet' || token === '-q') {
      globals.quiet = true
      continue
    }
    if (token === '--verbose' || token === '-v') {
      globals.verbose = true
      continue
    }

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

    if (token === '--help' || token === '-h') {
      globals.help = true
      continue
    }
    if (token === '--version') {
      globals.version = true
      continue
    }
    if (token === '--json') {
      globals.json = true
      continue
    }
    if (token === '--plain') {
      globals.plain = true
      continue
    }
    if (token === '--no-color') {
      globals.noColor = true
      continue
    }
    if (token === '--no-input') {
      globals.noInput = true
      continue
    }
    if (token === '--quiet' || token === '-q') {
      globals.quiet = true
      continue
    }
    if (token === '--verbose' || token === '-v') {
      globals.verbose = true
      continue
    }

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

    return {
      kind: 'config-set',
      key: positional[0],
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

  const helpTopicSet = new Set(['run', 'review', 'providers', 'config', 'presets'])
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
    if (helpTopicSet.has(topic)) {
      if (positional.length > 2) {
        throw new UsageError(`Unknown help topic '${positional[2]}'`)
      }
      return { kind: 'help', topic: topic as 'run' | 'review' | 'providers' | 'config' | 'presets' }
    }
    throw new UsageError(`Unknown help topic '${topic}'`)
  }

  if (aliasCommands.has(first)) {
    return parseRunLikeArgs(tokens.slice(1))
  }

  if (first === 'run') {
    return parseRunLikeArgs(tokens.slice(1))
  }
  if (first === 'review') {
    return parseReviewArgs(tokens.slice(1))
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

function formatError(error: unknown): string {
  if (error instanceof AggregatedProviderError) {
    const lines = [
      'All providers failed. Enable a configured provider and try again.',
      ...error.reasons.map((item: ProviderFailureReason) =>
        `- ${item.provider} (${item.stage}): ${item.reason}${item.hint ? ` — ${item.hint}` : ''}`,
      ),
    ]
    return lines.join('\n')
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function writeLine(line: string): void {
  process.stdout.write(line)
  if (!line.endsWith('\n')) {
    process.stdout.write('\n')
  }
}

function shouldUseJson(globals: GlobalOptions): boolean {
  return globals.json && !globals.plain
}

function outputForConfigResult(globals: GlobalOptions, value: unknown): void {
  if (shouldUseJson(globals)) {
    writeJson(value)
    return
  }

  if (typeof value === 'string') {
    writeLine(value)
    return
  }

  writeLine(JSON.stringify(value, null, 2))
}

async function executeCommand(parsed: ParsedCommand): Promise<void> {
  if (parsed.kind === 'help') {
    writeLine(usage(parsed.topic))
    return
  }

  if (parsed.kind === 'version') {
    writeLine(readPackageVersion())
    return
  }

  if (parsed.kind === 'run') {
    const explicitOutput: CliOutputMode | undefined = parsed.globals.json
      ? 'json'
      : parsed.globals.plain
        ? 'plain'
        : undefined

    const config = await loadConfig({
      flags: {
        output: explicitOutput,
      },
    })

    const presetName = parsed.options.preset ?? config.presets.default
    const preset = presetName ? config.presets.named[presetName] : undefined
    if (presetName && !preset) {
      throw new UsageError(`Unknown preset '${presetName}'`)
    }
    const effectiveOptions = mergeRunOptionsWithPreset(parsed.options, preset)

    const workspace = resolveWorkspacePath(effectiveOptions.workspace, config.workspace.last)
    const runtime = resolveRuntimeState({
      configOutput: config.output.default,
      explicitOutput,
      explicitFormat: explicitOutput,
    })

    const request: RunRequestInput = {
      prompt: parsed.prompt,
      provider: effectiveOptions.provider,
      model: effectiveOptions.model,
      workspace,
      mode: effectiveOptions.mode,
      trust: effectiveOptions.trust,
      output: runtime.outputMode,
      timeoutMs: effectiveOptions.timeoutMs,
      noFallback: effectiveOptions.noFallback,
      yolo: effectiveOptions.yolo,
      includeDirectories: effectiveOptions.includeDirectories,
      outputFormat: effectiveOptions.outputFormat,
      headless: effectiveOptions.headless,
      extensions: effectiveOptions.extensions,
      mcp: effectiveOptions.mcp,
    }

    const result = await runRequest({
      input: request,
      config,
    })

    const envelope = toResponseEnvelope(result)
    if (runtime.ttyAwareMode === 'json') {
      writeJson(envelope)
    } else {
      writeLine(envelope.response)
    }

    if (parsed.globals.verbose) {
      process.stderr.write(
        `[genie] provider=${result.provider} fallback=${String(result.fallbackUsed)} totalMs=${result.timings.totalMs}\n`,
      )
    }

    return
  }

  if (parsed.kind === 'review') {
    const config = await loadConfig()
    const result = await executeReviewCommand({
      all: parsed.options.all,
      agent: parsed.options.agent,
      diffFile: parsed.options.diffFile,
      config,
    })

    if (shouldUseJson(parsed.globals)) {
      writeJson(result)
    } else {
      writeLine(formatReviewReport(result))
    }

    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode
    }
    return
  }

  if (parsed.kind === 'providers-list') {
    const providers = await listProviders()
    if (shouldUseJson(parsed.globals)) {
      writeJson({ providers })
      return
    }
    for (const provider of providers) {
      writeLine(provider.id)
    }
    return
  }

  if (parsed.kind === 'providers-doctor') {
    const report = await doctorProviders(parsed.provider)
    if (shouldUseJson(parsed.globals)) {
      writeJson({ providers: report })
      return
    }

    for (const status of report) {
      const line = [
        status.provider,
        status.available ? 'available' : 'missing',
        status.authenticated ? 'authenticated' : 'unauthenticated',
        `${status.latencyMs}ms`,
      ].join(' | ')
      writeLine(line)
      if (status.hint && !parsed.globals.quiet) {
        process.stderr.write(`hint (${status.provider}): ${status.hint}\n`)
      }
    }
    return
  }

  if (parsed.kind === 'config-get') {
    const value = await configGet(parsed.key)
    outputForConfigResult(parsed.globals, value)
    return
  }

  if (parsed.kind === 'config-set') {
    const updated = await configSet(parsed.key, parsed.value)
    if (shouldUseJson(parsed.globals)) {
      writeJson(updated)
      return
    }
    writeLine(`Set ${parsed.key}`)
    return
  }

  if (parsed.kind === 'config-init') {
    const created = await configInit()
    if (shouldUseJson(parsed.globals)) {
      writeJson(created)
      return
    }
    writeLine('Initialized user config')
    return
  }

  if (parsed.kind === 'presets-list') {
    const value = await listPresets()
    outputForConfigResult(parsed.globals, value)
    return
  }

  if (parsed.kind === 'presets-get') {
    const value = await getPreset(parsed.name)
    outputForConfigResult(parsed.globals, value)
    return
  }

  if (parsed.kind === 'presets-set') {
    const result = await setPreset(
      parsed.options.name,
      {
        provider: parsed.options.provider,
        model: parsed.options.model,
        mode: parsed.options.mode,
        trust: parsed.options.trust,
        yolo: parsed.options.yolo,
        outputFormat: parsed.options.outputFormat,
        includeDirectories: parsed.options.includeDirectories,
        headless: parsed.options.headless,
        extensions: parsed.options.extensions,
        mcp: parsed.options.mcp,
      },
      {
        setDefault: parsed.options.setDefault,
      },
    )
    outputForConfigResult(parsed.globals, result)
    return
  }

  if (parsed.kind === 'presets-delete') {
    const result = await deletePreset(parsed.name)
    outputForConfigResult(parsed.globals, result)
    return
  }

  if (parsed.kind === 'presets-use') {
    const result = await usePreset(parsed.name)
    outputForConfigResult(parsed.globals, result)
    return
  }

  const paths = configPath()
  outputForConfigResult(parsed.globals, paths)
}

export async function runFromArgv(argv: string[]): Promise<void> {
  const parsed = parseArgv(argv)
  await executeCommand(parsed)
}

export async function cli(argv: string[] = process.argv.slice(2)): Promise<void> {
  try {
    await runFromArgv(argv)
  } catch (error) {
    const code = getExitCode(error)
    const message = formatError(error)
    const wantsJson = argv.includes('--json') && !argv.includes('--plain')

    if (wantsJson) {
      writeJson(
        toErrorEnvelope({
          code: String(code),
          message,
        }),
      )
    }

    process.stderr.write(`${message}\n`)
    process.exitCode = code
  }
}
