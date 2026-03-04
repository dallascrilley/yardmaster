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
import { providerIds, type CliOutputMode, type ProviderFailureReason, type ProviderId } from './types.js'
import { resolveWorkspacePath } from './runtime/workspace.js'
import { resolveRuntimeState } from './runtime/tty.js'
import {
  runRequest,
  toErrorEnvelope,
  toResponseEnvelope,
  type RunRequestInput,
} from './execution/run-request.js'
import { doctorProviders, listProviders } from './providers/doctor.js'

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
  trust: boolean
  timeoutMs?: number
  noFallback: boolean
}

type ParsedCommand =
  | { kind: 'help'; topic?: 'run' | 'providers' | 'config' }
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

function usage(topic?: ParsedCommand['kind'] | 'run' | 'providers' | 'config'): string {
  const root = [
    'Usage:',
    '  genie <prompt>',
    '  genie run [options] <prompt>',
    '  genie providers list [--json]',
    '  genie providers doctor [--provider <id>] [--json]',
    '  genie config get [key] [--json]',
    '  genie config set <key> <value>',
    '  genie config init',
    '  genie config path [--json]',
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
    '  --timeout-ms <n>',
    '  --no-fallback',
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

  if (topic === 'run') return run.join('\n')
  if (topic === 'providers') return providers.join('\n')
  if (topic === 'config') return config.join('\n')
  return root.join('\n')
}

function parseProvider(value: string, flag: string): ProviderId {
  if (!providerIds.includes(value as ProviderId)) {
    throw new UsageError(`Unknown provider '${value}' for ${flag}`)
  }
  return value as ProviderId
}

function parseRunLikeArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const options: RunOptions = { trust: false, noFallback: false }
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
      options.mode = value
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

  if (aliasCommands.has(first)) {
    return parseRunLikeArgs(tokens.slice(1))
  }

  if (first === 'run') {
    return parseRunLikeArgs(tokens.slice(1))
  }

  if (first === 'providers') {
    return parseProvidersArgs(tokens.slice(1))
  }

  if (first === 'config') {
    return parseConfigArgs(tokens.slice(1))
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
        provider: parsed.options.provider,
        model: parsed.options.model,
        mode: parsed.options.mode,
        workspace: parsed.options.workspace,
        trust: parsed.options.trust,
        timeoutMs: parsed.options.timeoutMs,
        output: explicitOutput,
      },
    })

    const workspace = resolveWorkspacePath(parsed.options.workspace, config.workspace.last)
    const runtime = resolveRuntimeState({
      configOutput: config.output.default,
      explicitOutput,
      explicitFormat: explicitOutput,
    })

    const request: RunRequestInput = {
      prompt: parsed.prompt,
      provider: parsed.options.provider,
      model: parsed.options.model,
      workspace,
      mode: parsed.options.mode,
      trust: parsed.options.trust,
      output: runtime.outputMode,
      timeoutMs: parsed.options.timeoutMs,
      noFallback: parsed.options.noFallback,
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
