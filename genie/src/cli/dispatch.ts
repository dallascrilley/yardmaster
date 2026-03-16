import { usage } from './help.js'
import { writeLine } from './output.js'
import { renderCompletion } from './completion.js'
import type { ParsedCommand } from './types.js'
import {
  handleCommitCommand,
  handleDebugCommand,
  handleDesignCommand,
  handleRunCommand,
} from './dispatch/prompt-commands.js'
import {
  assertUnreachableCommand,
  dispatchStateCommand,
  isStateCommand,
} from './dispatch/state-commands.js'
import { readPackageVersion } from './dispatch/shared.js'

export type CliDispatchDeps = {
  confirm?: (prompt: string) => Promise<boolean>
}

export async function executeCommand(
  parsed: ParsedCommand,
  deps?: CliDispatchDeps,
): Promise<void> {
  switch (parsed.kind) {
    case 'help':
      writeLine(usage(parsed.topic))
      return
    case 'version':
      writeLine(readPackageVersion())
      return
    case 'completion':
      writeLine(renderCompletion(parsed.shell))
      return
    case 'run':
      return handleRunCommand(parsed)
    case 'design':
      return handleDesignCommand(parsed)
    case 'commit':
      return handleCommitCommand(parsed)
    case 'debug':
      return handleDebugCommand(parsed)
    default:
      if (isStateCommand(parsed)) {
        return dispatchStateCommand(parsed, deps)
      }
      return assertUnreachableCommand(parsed)
  }
}
