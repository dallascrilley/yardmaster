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

const stateKinds = new Set<ParsedCommand['kind']>([
  'review',
  'update',
  'providers-list',
  'providers-doctor',
  'config-get',
  'config-set',
  'config-init',
  'config-path',
  'presets-list',
  'presets-get',
  'presets-set',
  'presets-delete',
  'presets-use',
])

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

  if (stateKinds.has(parsed.kind)) {
    await dispatchStateCommand(parsed as never, deps)
    return
  }

  assertUnreachableCommand()
}
