import { UsageError } from '../../../errors.js'
import { parseReviewAgent } from '../../../review/command.js'
import type { ParsedCommand, ReviewOptions } from '../../types.js'
import { defaultGlobals, parseGlobalFlag } from '../shared.js'

export function parseReviewArgs(tokens: string[]): ParsedCommand {
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
