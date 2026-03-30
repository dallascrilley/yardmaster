import { UsageError } from '../errors.js'
import type { ParsedCommand } from './types.js'
import {
  aliasCommands,
  isStrictCommandsEnabled,
  looksLikeMistypedRootCommand,
  parseRunLikeArgs,
  rootCommands,
  shouldPreservePromptShorthand,
} from './parse/commands.js'
import { getPositionalTokens, getRootParser, parseValidatedHelpCommand } from './parse/root.js'

/**
 * Parse raw `process.argv` tokens (after the node/binary prefix) into a
 * structured {@link ParsedCommand}. Handles help/version flags, subcommand
 * routing, alias expansion, strict-mode validation, and implicit `run`.
 * @param argv - The argv tokens to parse (typically `process.argv.slice(2)`).
 * @returns A discriminated union describing the parsed command and its options.
 * @throws {UsageError} On unknown commands or help topics.
 */
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

  const positional = getPositionalTokens(tokens)

  const helpCommand = parseValidatedHelpCommand(positional)
  if (helpCommand) {
    return helpCommand
  }

  const cmd = positional[0]
  if (cmd && aliasCommands.has(cmd)) {
    const index = tokens.indexOf(cmd)
    const runTokens = [...tokens.slice(0, index), ...tokens.slice(index + 1)]
    return parseRunLikeArgs(runTokens)
  }

  const parser = getRootParser(first)
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
