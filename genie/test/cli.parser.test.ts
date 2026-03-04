import { describe, expect, it } from 'vitest'

import { parseArgv } from '../src/cli.js'

describe('cli parser', () => {
  it('parses legacy shorthand prompt invocation', () => {
    const parsed = parseArgv(['hello world'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.prompt).toBe('hello world')
  })

  it('parses explicit run invocation with run flags', () => {
    const parsed = parseArgv(['run', '-p', 'codex', '--timeout-ms', '5000', 'hello'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.options.provider).toBe('codex')
    expect(parsed.options.timeoutMs).toBe(5000)
  })

  it('parses providers and config command trees', () => {
    expect(parseArgv(['providers', 'list', '--json']).kind).toBe('providers-list')
    expect(parseArgv(['providers', 'doctor', '--provider', 'gemini']).kind).toBe('providers-doctor')
    expect(parseArgv(['config', 'get']).kind).toBe('config-get')
    expect(parseArgv(['config', 'set', 'mode.default', 'fast']).kind).toBe('config-set')
  })

  it('returns help command with explicit topic', () => {
    const parsed = parseArgv(['providers', '--help'])
    expect(parsed.kind).toBe('help')
    if (parsed.kind !== 'help') throw new Error('expected help')
    expect(parsed.topic).toBe('providers')
  })
})
