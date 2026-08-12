import { UsageError } from '../../errors.js'
import type { HelpTopic, ParsedCommand } from '../types.js'
import {
  parseCommitArgs,
  parseCompletionArgs,
  parseConfigArgs,
  parseDebugArgs,
  parseDesignArgs,
  parsePresetsArgs,
  parseProvidersArgs,
  parseReviewArgs,
  parseRunLikeArgs,
  parseUpdateArgs,
} from './commands.js'

const helpTopicSet = new Set<HelpTopic>([
  'run',
  'design',
  'commit',
  'debug',
  'review',
  'update',
  'providers',
  'config',
  'presets',
  'completion',
])

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

const rootParsers = new Map<string, (tokens: string[]) => ParsedCommand>([
  ['run', parseRunLikeArgs],
  ['design', parseDesignArgs],
  ['commit', parseCommitArgs],
  ['debug', parseDebugArgs],
  ['review', parseReviewArgs],
  ['update', parseUpdateArgs],
  ['providers', parseProvidersArgs],
  ['presets', parsePresetsArgs],
  ['config', parseConfigArgs],
  ['completion', parseCompletionArgs],
])

export function getPositionalTokens(tokens: string[]): string[] {
  const positional: string[] = []
  for (const token of tokens) {
    if (globalFlagSet.has(token)) continue
    positional.push(token)
  }
  return positional
}

export function parseHelpCommand(positional: string[]): ParsedCommand | undefined {
  if (positional[0] !== 'help') {
    return undefined
  }

  const topic = positional[1]
  if (!topic) {
    return { kind: 'help' }
  }

  if (helpTopicSet.has(topic as HelpTopic)) {
    return { kind: 'help', topic: topic as HelpTopic }
  }

  return undefined
}

export function parseValidatedHelpCommand(positional: string[]): ParsedCommand | undefined {
  const helpCommand = parseHelpCommand(positional)
  if (helpCommand) {
    if (positional.length > 2) {
      throw new UsageError(`Unknown help topic '${positional[2]}'`)
    }
    return helpCommand
  }

  if (positional[0] === 'help') {
    throw new UsageError(`Unknown help topic '${positional[1]}'`)
  }

  return undefined
}

export function getRootParser(command: string | undefined): ((tokens: string[]) => ParsedCommand) | undefined {
  if (!command) {
    return undefined
  }

  return rootParsers.get(command)
}
