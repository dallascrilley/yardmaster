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

const promptHandlers = {
  run: handleRunCommand,
  design: handleDesignCommand,
  commit: handleCommitCommand,
  debug: handleDebugCommand,
} satisfies Partial<Record<ParsedCommand['kind'], (parsed: any) => Promise<void>>>

export async function executeCommand(
  parsed: ParsedCommand,
  deps?: CliDispatchDeps,
): Promise<void> {
  if (parsed.kind === 'help') {
    writeLine(usage(parsed.topic))
    return
  }

  if (parsed.kind === 'version') {
    writeLine(readPackageVersion())
    return
  }

  if (parsed.kind === 'completion') {
    writeLine(renderCompletion(parsed.shell))
    return
  }

  const promptHandler = promptHandlers[parsed.kind as keyof typeof promptHandlers]
  if (promptHandler) {
    await promptHandler(parsed as never)
    return
  }

  if (isStateCommand(parsed)) {
    await dispatchStateCommand(parsed, deps)
    return
  }

  assertUnreachableCommand(parsed as never)
}
