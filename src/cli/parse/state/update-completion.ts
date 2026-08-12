import { UsageError } from '../../../errors.js'
import type { CompletionShell, ParsedCommand } from '../../types.js'
import { defaultGlobals, defaultMutationSafety, parseGlobalFlag, parseMutationFlag } from '../shared.js'

export function parseUpdateArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  const safety = defaultMutationSafety()

  for (const token of tokens) {
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue
    if (parseMutationFlag(token, safety)) continue
    throw new UsageError(`Unknown update argument '${token}'`)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help) return { kind: 'help', topic: 'update' }
  return {
    kind: 'update',
    globals,
    safety,
  }
}

export function parseCompletionArgs(tokens: string[]): ParsedCommand {
  const globals = defaultGlobals()
  let shell: CompletionShell | undefined

  for (const token of tokens) {
    if (!token) continue
    if (parseGlobalFlag(token, globals)) continue
    if (token === 'bash' || token === 'zsh' || token === 'fish') {
      shell = token
      continue
    }
    throw new UsageError(`Unknown completion argument '${token}'`)
  }

  if (globals.version) return { kind: 'version' }
  if (globals.help || !shell) return { kind: 'help', topic: 'completion' }
  return {
    kind: 'completion',
    globals,
    shell,
  }
}
