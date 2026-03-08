import { UsageError } from '../errors.js'
import type { HelpTopic, ParsedCommand } from './types.js'
import {
  aliasCommands,
  isStrictCommandsEnabled,
  looksLikeMistypedRootCommand,
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
  rootCommands,
  shouldPreservePromptShorthand,
} from './parse/commands.js'

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

  const parser = rootParsers.get(first)
  if (parser) {
    return parser(tokens.slice(1))
  }

  const strictToken = positional[0]
  if (strictToken?.startsWith('-')) {
    return parseRunLikeArgs(tokens)
  }
  if (
    strictToken &&
    !rootCommands.has(strictToken) &&
    isStrictCommandsEnabled() &&
    (!shouldPreservePromptShorthand(positional) || looksLikeMistypedRootCommand(strictToken))
  ) {
    throw new UsageError(`Unknown command '${strictToken}'. Use 'genie help' for usage.`)
  }

  return parseRunLikeArgs(tokens)
}
