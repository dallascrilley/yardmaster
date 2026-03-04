import { readFileSync } from 'node:fs'

import { AggregatedProviderError } from './errors.js'
import { loadConfig } from './config/store.js'
import { providerIds, type CliOutputMode, type ProviderId, type ProviderFailureReason } from './types.js'
import { resolveWorkspacePath } from './runtime/workspace.js'
import { parseExplicitFormat, resolveRuntimeState } from './runtime/tty.js'
import { runRequest, toResponseEnvelope, type RunRequestInput } from './execution/run-request.js'

type CliOptions = {
  provider?: ProviderId
  model?: string
  workspace?: string
  mode?: string
  trust: boolean
  output?: CliOutputMode
  format?: string
}

type ParsedInput = {
  prompt: string
  options: CliOptions
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

function printUsage(): never {
  const output = [
    'Usage: genie [options] <prompt>',
    '       genie wish|rub [options] <prompt>',
    '',
    'Options:',
    '  --provider, -p <id>      Preferred provider',
    '  --model, -m <name>       Provider model',
    '  --workspace, -w <path>   Working directory',
    '  --mode <name>            Provider mode',
    '  --trust                   Skip safety prompts if supported',
    '  --output <auto|pretty|json>  Output mode',
    '  --format <json|pretty|toon|yaml|md>',
    '  --json                   Force JSON output',
    '  --help, -h               Show this help',
    '  --version, -v            Show version',
    '',
    `Providers: ${providerIds.join(', ')}`,
  ]

  process.stdout.write(`${output.join('\n')}\n`)
  process.exit(0)
}

function parsePositionalAndOptions(argv: string[]): ParsedInput {
  const inputArgs = [...argv]

  if (inputArgs[0] && aliasCommands.has(inputArgs[0])) {
    inputArgs.shift()
  }

  const options: CliOptions = { trust: false }
  const positional: string[] = []

  for (let index = 0; index < inputArgs.length; index += 1) {
    const token = inputArgs[index]
    if (!token) continue

    if (token === '--help' || token === '-h') {
      printUsage()
    }

    if (token === '--version' || token === '-v') {
      process.stdout.write(`${readPackageVersion()}\n`)
      process.exit(0)
    }

    if (token === '--json') {
      options.output = 'json'
      options.format = 'json'
      continue
    }

    if (token === '--trust') {
      options.trust = true
      continue
    }

    if (token === '--provider' || token === '-p') {
      const value = inputArgs[index + 1]
      if (!value) throw new Error(`Missing value for ${token}`)
      if (!providerIds.includes(value as ProviderId)) {
        throw new Error(`Unknown provider '${value}'`)
      }
      options.provider = value as ProviderId
      index += 1
      continue
    }

    if (token === '--model' || token === '-m') {
      options.model = inputArgs[index + 1]
      if (!options.model) throw new Error(`Missing value for ${token}`)
      index += 1
      continue
    }

    if (token === '--workspace' || token === '-w') {
      options.workspace = inputArgs[index + 1]
      if (!options.workspace) throw new Error(`Missing value for ${token}`)
      index += 1
      continue
    }

    if (token === '--mode') {
      options.mode = inputArgs[index + 1]
      if (!options.mode) throw new Error(`Missing value for ${token}`)
      index += 1
      continue
    }

    if (token === '--output') {
      const value = inputArgs[index + 1]
      if (value !== 'auto' && value !== 'pretty' && value !== 'json') {
        throw new Error(`Invalid output mode '${value}'`)
      }
      options.output = value
      index += 1
      continue
    }

    if (token === '--format') {
      options.format = inputArgs[index + 1]
      if (!options.format) throw new Error('Missing value for --format')
      index += 1
      continue
    }

    if (token.startsWith('--format=')) {
      options.format = token.slice('--format='.length)
      continue
    }

    if (token.startsWith('-')) {
      throw new Error(`Unknown option '${token}'`)
    }

    positional.push(token)
  }

  const prompt = positional.join(' ').trim()
  if (!prompt) {
    throw new Error('Prompt is required')
  }

  return {
    prompt,
    options,
  }
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

export async function runFromArgv(argv: string[]): Promise<ReturnType<typeof toResponseEnvelope>> {
  const parsed = parsePositionalAndOptions(argv)
  const config = await loadConfig()
  const workspace = resolveWorkspacePath(parsed.options.workspace, config.workspace.last)

  const parsedFormat = parsed.options.format ?? parseExplicitFormat(argv)
  const runtime = resolveRuntimeState({
    configOutput: config.output.default,
    explicitOutput: parsed.options.output,
    explicitFormat: parsedFormat,
    argv,
  })

  const request: RunRequestInput = {
    prompt: parsed.prompt,
    provider: parsed.options.provider,
    model: parsed.options.model,
    workspace,
    mode: parsed.options.mode,
    trust: parsed.options.trust,
    output: runtime.outputMode,
  }

  const result = await runRequest({
    input: request,
    config,
  })

  const envelope = toResponseEnvelope(result)
  if (runtime.ttyAwareMode === 'json' || parsed.options.output === 'json') {
    process.stdout.write(JSON.stringify(envelope, null, 2))
    process.stdout.write('\n')
  } else {
    process.stdout.write(envelope.response)
    if (!envelope.response.endsWith('\n')) {
      process.stdout.write('\n')
    }
  }

  return envelope
}

export async function cli(argv: string[] = process.argv.slice(2)): Promise<void> {
  try {
    await runFromArgv(argv)
  } catch (error) {
    process.stderr.write(`${formatError(error)}\n`)
    process.exitCode = 1
  }
}
