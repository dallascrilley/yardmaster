import type { CliDispatchDeps } from '../dispatch.js'
import type { ParsedCommand } from '../types.js'
import { handleReviewCommand } from './state/review.js'
import { handleUpdateCommand } from './state/update.js'
import { handleProvidersDoctorCommand, handleProvidersListCommand } from './state/providers.js'
import { handleConfigGetCommand, handleConfigInitCommand, handleConfigPathCommand, handleConfigSetCommand } from './state/config.js'
import { handlePresetsDeleteCommand, handlePresetsGetCommand, handlePresetsListCommand, handlePresetsSetCommand, handlePresetsUseCommand } from './state/presets.js'

export { handleConfigGetCommand, handleConfigInitCommand, handleConfigPathCommand, handleConfigSetCommand }
export { handlePresetsDeleteCommand, handlePresetsGetCommand, handlePresetsListCommand, handlePresetsSetCommand, handlePresetsUseCommand }
export { handleProvidersDoctorCommand, handleProvidersListCommand }
export { handleReviewCommand, handleUpdateCommand }

export type StateParsedCommand = Extract<
  ParsedCommand,
  | { kind: 'review' }
  | { kind: 'update' }
  | { kind: 'providers-list' }
  | { kind: 'providers-doctor' }
  | { kind: 'config-get' }
  | { kind: 'config-set' }
  | { kind: 'config-init' }
  | { kind: 'config-path' }
  | { kind: 'presets-list' }
  | { kind: 'presets-get' }
  | { kind: 'presets-set' }
  | { kind: 'presets-delete' }
  | { kind: 'presets-use' }
>

export const stateCommandKinds: StateParsedCommand['kind'][] = [
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
]

const stateCommandKindLookup: Record<StateParsedCommand['kind'], true> = {
  review: true,
  update: true,
  'providers-list': true,
  'providers-doctor': true,
  'config-get': true,
  'config-set': true,
  'config-init': true,
  'config-path': true,
  'presets-list': true,
  'presets-get': true,
  'presets-set': true,
  'presets-delete': true,
  'presets-use': true,
}

export function isStateCommand(parsed: ParsedCommand): parsed is StateParsedCommand {
  return parsed.kind in stateCommandKindLookup
}

export function assertUnreachableCommand(_: never): never {
  throw new Error('Unknown state command kind')
}

export async function dispatchStateCommand(
  parsed: StateParsedCommand,
  deps?: CliDispatchDeps,
): Promise<void> {
  switch (parsed.kind) {
    case 'review':
      return handleReviewCommand(parsed)
    case 'update':
      return handleUpdateCommand(parsed, deps)
    case 'providers-list':
      return handleProvidersListCommand(parsed)
    case 'providers-doctor':
      return handleProvidersDoctorCommand(parsed)
    case 'config-get':
      return handleConfigGetCommand(parsed)
    case 'config-set':
      return handleConfigSetCommand(parsed)
    case 'config-init':
      return handleConfigInitCommand(parsed, deps)
    case 'config-path':
      return handleConfigPathCommand(parsed)
    case 'presets-list':
      return handlePresetsListCommand(parsed)
    case 'presets-get':
      return handlePresetsGetCommand(parsed)
    case 'presets-set':
      return handlePresetsSetCommand(parsed, deps)
    case 'presets-delete':
      return handlePresetsDeleteCommand(parsed, deps)
    case 'presets-use':
      return handlePresetsUseCommand(parsed)
    default:
      return assertUnreachableCommand(parsed)
  }
}
