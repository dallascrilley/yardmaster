import { describe, expect, it } from 'vitest'

import { parseExplicitFormat, resolveOutputMode, resolveRuntimeState } from '../src/runtime/tty.js'
import { resolveWorkspacePath } from '../src/runtime/workspace.js'

describe('runtime tty and workspace', () => {
  it('parses explicit format flags', () => {
    expect(parseExplicitFormat(['--format', 'json'])).toBe('json')
    expect(parseExplicitFormat(['--format=plain'])).toBe('plain')
    expect(parseExplicitFormat(['--json'])).toBe('json')
    expect(parseExplicitFormat(['--plain'])).toBe('plain')
  })

  it('resolves output mode by runtime settings', () => {
    expect(resolveOutputMode({ interactive: false, outputMode: 'auto' })).toBe('json')
    expect(resolveOutputMode({ interactive: true, outputMode: 'pretty' })).toBe('pretty')
    expect(resolveOutputMode({ interactive: true, outputMode: 'plain' })).toBe('plain')
    expect(resolveOutputMode({ interactive: true, outputMode: 'auto', explicitFormat: 'json' })).toBe('json')
  })

  it('builds runtime state from explicit command format', () => {
    const state = resolveRuntimeState({
      configOutput: 'auto',
      explicitOutput: 'json',
      explicitFormat: 'json',
      argv: ['--json'],
    })

    expect(state.outputMode).toBe('json')
    expect(state.ttyAwareMode).toBe('json')
  })

  it('resolves workspace precedence', () => {
    expect(resolveWorkspacePath('/tmp/explicit', '/tmp/last')).toBe('/tmp/explicit')
    expect(resolveWorkspacePath(undefined, '/tmp/last')).toBe('/tmp/last')
  })
})
