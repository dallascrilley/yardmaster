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
    const parsed = parseArgv([
      'run',
      '-p',
      'codex',
      '--preset',
      'fast',
      '--yolo',
      '--include-directories',
      'a,b',
      '--output-format',
      'json',
      '--print',
      '--timeout-ms',
      '5000',
      'hello',
    ])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.options.provider).toBe('codex')
    expect(parsed.options.preset).toBe('fast')
    expect(parsed.options.yolo).toBe(true)
    expect(parsed.options.includeDirectories).toEqual(['a', 'b'])
    expect(parsed.options.outputFormat).toBe('json')
    expect(parsed.options.headless).toBe(true)
    expect(parsed.options.timeoutMs).toBe(5000)
  })

  it('rejects invalid mode values in run parsing', () => {
    expect(() => parseArgv(['run', '--mode', 'invalidmode', 'hello'])).toThrow(
      "Unknown mode 'invalidmode' for --mode",
    )
  })

  it('treats unknown single token as shorthand prompt', () => {
    const parsed = parseArgv(['gleep'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.prompt).toBe('gleep')
  })

  it('rejects unknown root command when strict mode is enabled', () => {
    const previous = process.env.GENIE_STRICT_COMMANDS
    process.env.GENIE_STRICT_COMMANDS = '1'
    try {
      expect(() => parseArgv(['gleep'])).toThrow("Unknown command 'gleep'. Use 'genie help' for usage.")
    } finally {
      if (previous === undefined) {
        delete process.env.GENIE_STRICT_COMMANDS
      } else {
        process.env.GENIE_STRICT_COMMANDS = previous
      }
    }
  })

  it('rejects unknown root command when strict mode is enabled with leading global flags', () => {
    const previous = process.env.GENIE_STRICT_COMMANDS
    process.env.GENIE_STRICT_COMMANDS = '1'
    try {
      expect(() => parseArgv(['--json', 'gleep'])).toThrow("Unknown command 'gleep'. Use 'genie help' for usage.")
    } finally {
      if (previous === undefined) {
        delete process.env.GENIE_STRICT_COMMANDS
      } else {
        process.env.GENIE_STRICT_COMMANDS = previous
      }
    }
  })

  it('parses providers and config command trees', () => {
    expect(parseArgv(['update']).kind).toBe('update')

    expect(parseArgv(['review', '--all']).kind).toBe('review')
    const reviewStaged = parseArgv(['review', '--all', '--staged'])
    expect(reviewStaged.kind).toBe('review')
    if (reviewStaged.kind !== 'review') throw new Error('expected review')
    expect(reviewStaged.options.staged).toBe(true)
    const reviewBase = parseArgv(['review', '--all', '--base', 'origin/main'])
    expect(reviewBase.kind).toBe('review')
    if (reviewBase.kind !== 'review') throw new Error('expected review')
    expect(reviewBase.options.base).toBe('origin/main')
    const reviewSingle = parseArgv(['review', '--agent', 'cursor'])
    expect(reviewSingle.kind).toBe('review')
    if (reviewSingle.kind !== 'review') throw new Error('expected review')
    expect(reviewSingle.options.agent).toBe('cursor')
    const reviewAlias = parseArgv(['review', '--agent', 'cursor-agent'])
    expect(reviewAlias.kind).toBe('review')
    if (reviewAlias.kind !== 'review') throw new Error('expected review')
    expect(reviewAlias.options.agent).toBe('cursor')

    expect(parseArgv(['providers', 'list', '--json']).kind).toBe('providers-list')
    expect(parseArgv(['providers', 'doctor', '--provider', 'gemini']).kind).toBe('providers-doctor')
    expect(parseArgv(['config', 'get']).kind).toBe('config-get')
    expect(parseArgv(['config', 'set', 'mode.default', 'fast']).kind).toBe('config-set')
    expect(parseArgv(['presets', 'list']).kind).toBe('presets-list')
    expect(parseArgv(['presets', 'get', 'default']).kind).toBe('presets-get')
    expect(parseArgv(['presets', 'set', 'default', '--provider', 'codex']).kind).toBe('presets-set')
    expect(parseArgv(['presets', 'delete', 'default']).kind).toBe('presets-delete')
    expect(parseArgv(['presets', 'use', 'default']).kind).toBe('presets-use')
  })

  it('rejects conflicting explicit review diff-source flags', () => {
    expect(() => parseArgv(['review', '--all', '--staged', '--diff-file', 'a.diff'])).toThrow(
      '--staged cannot be used with --diff-file',
    )
    expect(() => parseArgv(['review', '--all', '--base', 'main', '--diff-file', 'a.diff'])).toThrow(
      '--base cannot be used with --diff-file',
    )
    expect(() => parseArgv(['review', '--all', '--base', 'main', '--staged'])).toThrow(
      '--base cannot be used with --staged',
    )
  })

  it('returns help command with explicit topic', () => {
    const updateHelp = parseArgv(['update', '--help'])
    expect(updateHelp.kind).toBe('help')
    if (updateHelp.kind !== 'help') throw new Error('expected help')
    expect(updateHelp.topic).toBe('update')

    const reviewHelp = parseArgv(['review', '--help'])
    expect(reviewHelp.kind).toBe('help')
    if (reviewHelp.kind !== 'help') throw new Error('expected help')
    expect(reviewHelp.topic).toBe('review')

    const parsed = parseArgv(['providers', '--help'])
    expect(parsed.kind).toBe('help')
    if (parsed.kind !== 'help') throw new Error('expected help')
    expect(parsed.topic).toBe('providers')

    const presetsHelp = parseArgv(['presets', '--help'])
    expect(presetsHelp.kind).toBe('help')
    if (presetsHelp.kind !== 'help') throw new Error('expected help')
    expect(presetsHelp.topic).toBe('presets')
  })

  it('parses explicit help command variants at root', () => {
    const rootHelp = parseArgv(['help'])
    expect(rootHelp.kind).toBe('help')

    const runHelp = parseArgv(['help', 'run'])
    expect(runHelp.kind).toBe('help')
    if (runHelp.kind !== 'help') throw new Error('expected help')
    expect(runHelp.topic).toBe('run')

    const updateHelp = parseArgv(['help', 'update'])
    expect(updateHelp.kind).toBe('help')
    if (updateHelp.kind !== 'help') throw new Error('expected help')
    expect(updateHelp.topic).toBe('update')

    const jsonHelp = parseArgv(['--json', 'help'])
    expect(jsonHelp.kind).toBe('help')

    const dashHelp = parseArgv(['-h'])
    expect(dashHelp.kind).toBe('help')

    const commandHelpFlag = parseArgv(['help', '--help'])
    expect(commandHelpFlag.kind).toBe('help')
  })
})
