import { describe, expect, it } from 'vitest'

import { isStateCommand, stateCommandKinds } from '../src/cli/dispatch/state-commands.js'
import type { ParsedCommand } from '../src/cli/types.js'

function globals() {
  return {
    help: false,
    version: false,
    json: false,
    plain: false,
    noColor: false,
    quiet: false,
    verbose: false,
    noInput: false,
  }
}

describe('cli dispatch helpers', () => {
  it('exposes the complete state command kind list', () => {
    expect(stateCommandKinds).toEqual([
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
  })

  it('identifies state commands without matching prompt/help/version commands', () => {
    const commands: ParsedCommand[] = [
      { kind: 'providers-list', globals: globals() },
      { kind: 'review', globals: globals(), options: { all: true, staged: false, jsonSchema: false } },
      { kind: 'run', globals: globals(), options: { noFallback: false }, prompt: 'hello' },
      { kind: 'help', topic: 'review' },
      { kind: 'version' },
      { kind: 'completion', globals: globals(), shell: 'bash' },
    ]

    expect(commands.map((command) => isStateCommand(command))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ])
  })
})
