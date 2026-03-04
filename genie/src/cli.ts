import {
  Cli,
  createCli,
  Formatter,
  AuthError,
  ConfigError,
  z,
} from 'dc-cli-kit'

import { loadConfig } from './config/store.js'
import { providerIds } from './types.js'
import { cliOutputModeSchema, type CliOutputMode } from './types.js'
import { resolveWorkspacePath } from './runtime/workspace.js'
import { parseExplicitFormat, isAgentContext, resolveOutputMode } from './runtime/tty.js'
import { runRequest, toResponseEnvelope, type run } from './execution/run-request.js'

const requestOptionsSchema = z.object({
  provider: z.enum(providerIds).optional().describe('Preferred provider'),
  model: z.string().trim().optional().describe('Provider model to use'),
  workspace: z.string().trim().optional().describe('Workspace path'),
  mode: z.string().trim().optional().describe('Provider execution mode'),
  trust: z.boolean().default(false).describe('Skip safety prompts when supported'),
  output: cliOutputModeSchema.default('auto').describe('Output mode: auto|pretty|json'),
})

const requestArgsSchema = z.object({
  prompt: z.string().trim().min(1).describe('Prompt text to send to the provider'),
})

const responseSchema = z.object({
  provider: z.enum(providerIds),
  model: z.string().optional(),
  mode: z.string(),
  workspace: z.string(),
  trust: z.boolean(),
  response: z.string(),
})

function requestArgsForCommand(rawArgs: { prompt: string }, providedWorkspace?: string) {
  const prompt = rawArgs.prompt
  if (!prompt.trim()) {
    throw new ConfigError({ message: 'Prompt cannot be empty.' })
  }

  return {
    prompt,
  }
}

async function executeCommand(args: { prompt: string }, options: ReturnType<typeof requestOptionsSchema.parse>): Promise<ReturnType<typeof responseSchema.parse>> {
  const config = await loadConfig()
  const workspace = resolveWorkspacePath(options.workspace, config.workspace.last)
  const explicitFormat = parseExplicitFormat(process.argv.slice(2))
  const outputMode = options.output as CliOutputMode

  try {
    const result = await runRequest({
      input: {
        prompt: args.prompt,
        provider: options.provider,
        model: options.model,
        workspace,
        mode: options.mode,
        trust: options.trust,
        output: outputMode,
      },
      config,
      runner: undefined as never,
    })

    const mode = isAgentContext() || outputMode === 'json' || (!outputMode && explicitFormat === 'json') ? 'json' : resolveOutputMode({
      agent: isAgentContext(),
      outputMode,
      explicitFormat,
    })

    if (!explicitFormat) {
      const printable = {
        ...toResponseEnvelope(result),
      }
      process.stdout.write(Formatter.format(printable, mode === 'json' ? 'json' : 'toon'))
      if (!String(process.stdout.write).includes('')) {
        // no-op
      }
    }

    return toResponseEnvelope(result)
  } catch (error) {
    if (error instanceof Error && error.name === 'AggregatedProviderError') {
      const summary = error.message
      throw new ConfigError({ message: summary })
    }

    if (error instanceof Error && error.message.includes('is not authenticated')) {
      throw new AuthError({ message: error.message, hint: 'Authenticate provider and retry.' })
    }

    throw error
  }
}

export const cli = createCli('genie', {
  version: '0.1.0',
  description: 'A fast, multi-provider CLI for headless LLM prompts',
  args: requestArgsSchema,
  options: requestOptionsSchema,
  output: responseSchema,
  outputPolicy: 'agent-only',
  format: 'json',
  run: async (context) => {
    const args = requestArgsForCommand(context.args)
    const out = await executeCommand(args, context.options)
    return context.ok(out)
  },
})

function buildAlias(name: string) {
  cli.command(name, {
    args: requestArgsSchema,
    options: requestOptionsSchema,
    output: responseSchema,
    outputPolicy: 'agent-only',
    run: async (context) => {
      const args = requestArgsForCommand(context.args)
      return context.ok(await executeCommand(args, context.options))
    },
  })
}

buildAlias('wish')
buildAlias('rub')

export type GenieCliRun = typeof cli
