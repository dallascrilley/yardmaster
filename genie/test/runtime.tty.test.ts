import { describe, expect, it } from 'vitest'

import { parseExplicitFormat, resolveOutputMode, resolveRuntimeState } from '../src/runtime/tty.js'
import { resolveWorkspacePath } from '../src/runtime/workspace.js'

describe('runtime tty and workspace', () => {
  it('parses explicit format flags', () => {
    expect(parseExplicitFormat(['--format', 'json'])).toBe('json')
    expect(parseExplicitFormat(['--format=json'])).toBe('json')
    expect(parseExplicitFormat(['--json'])).toBe('json')
    expect(parseExplicitFormat(['--output', 'pretty'])).toBeUndefined()
  })

  it('resolves output mode by runtime settings', () => {
    expect(resolveOutputMode({ agent: true, outputMode: 'auto' })).toBe('json')
    expect(resolveOutputMode({ agent: true, outputMode: 'pretty' })).toBe('pretty')
    expect(resolveOutputMode({ agent: true, outputMode: 'auto', explicitFormat: 'json' })).toBe('json')
    expect(resolveOutputMode({ agent: false, outputMode: 'auto' })).toBe('pretty')
    expect(resolveOutputMode({ agent: false, outputMode: 'json' })).toBe('json')
  })

  it('builds runtime state from explicit command format', () => {
    const state = resolveRuntimeState({
      configOutput: 'auto',
      explicitOutput: undefined,
      explicitFormat: undefined,
      argv: ['--format', 'json'],
    })

    expect(state.outputMode).toBe('auto')
    expect(state.explicitFormat).toBe('json')
    expect(state.ttyAwareMode).toBe('json')
  })

  it('resolves workspace precedence', () => {
    expect(resolveWorkspacePath('/tmp/explicit', '/tmp/last')).toBe('/tmp/explicit')
    expect(resolveWorkspacePath(undefined, '/tmp/last')).toBe('/tmp/last')
  })
})
