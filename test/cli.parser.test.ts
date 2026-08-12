import { describe, expect, it } from 'vitest'

import { parseArgv } from '../src/cli.js'

describe('cli parser', () => {
  it('keeps parser command-kind behavior stable via table-driven cases', () => {
    const cases: Array<{ argv: string[]; kind: string; topic?: string }> = [
      { argv: ['run', 'hello'], kind: 'run' },
      { argv: ['design', 'hero audit'], kind: 'design' },
      { argv: ['commit'], kind: 'commit' },
      { argv: ['commit', '--apply'], kind: 'commit' },
      { argv: ['run', '--prompt-file', 'prompt.txt'], kind: 'run' },
      { argv: ['debug', '--provider', 'codex'], kind: 'debug' },
      { argv: ['debug', '--input-file', 'error.log'], kind: 'debug' },
      { argv: ['wish', 'hello'], kind: 'run' },
      { argv: ['rub', 'hello'], kind: 'run' },
      { argv: ['providers', 'list'], kind: 'providers-list' },
      { argv: ['providers', 'doctor', '--provider', 'codex'], kind: 'providers-doctor' },
      { argv: ['completion', 'bash'], kind: 'completion' },
      { argv: ['config', 'path'], kind: 'config-path' },
      { argv: ['config', 'init'], kind: 'config-init' },
      { argv: ['config', 'init', '--dry-run'], kind: 'config-init' },
      { argv: ['presets', 'set', 'nightly', '--mode', 'default'], kind: 'presets-set' },
      { argv: ['presets', 'delete', 'nightly', '--force'], kind: 'presets-delete' },
      { argv: ['presets', 'use', 'nightly'], kind: 'presets-use' },
      { argv: ['update', '--dry-run'], kind: 'update' },
      { argv: ['review', '--json-schema'], kind: 'review' },
      { argv: ['help', 'commit'], kind: 'help', topic: 'commit' },
      { argv: ['help', 'design'], kind: 'help', topic: 'design' },
      { argv: ['help', 'debug'], kind: 'help', topic: 'debug' },
      { argv: ['help', 'completion'], kind: 'help', topic: 'completion' },
      { argv: ['help', 'providers'], kind: 'help', topic: 'providers' },
      { argv: ['--version'], kind: 'version' },
      { argv: ['--json', 'wish', 'hello'], kind: 'run' },
    ]

    for (const testCase of cases) {
      const parsed = parseArgv(testCase.argv)
      expect(parsed.kind, `argv=${testCase.argv.join(' ')}`).toBe(testCase.kind)
      if (testCase.topic) {
        expect(parsed.kind).toBe('help')
        if (parsed.kind !== 'help') throw new Error('expected help')
        expect(parsed.topic).toBe(testCase.topic)
      }

      if (testCase.argv.join(' ') === '--json wish hello') {
        expect(parsed.kind).toBe('run')
        if (parsed.kind !== 'run') throw new Error('expected run')
        expect(parsed.globals.json).toBe(true)
        expect(parsed.prompt).toBe('hello')
      }
    }
  })

  it('normalizes provider and mode values in run parsing', () => {
    const parsed = parseArgv(['run', '--provider', ' CLAUDE ', '--mode', 'DEFAULT', 'hello'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.options.provider).toBe('claude')
    expect(parsed.options.mode).toBe('default')
  })

  it('normalizes provider and mode values in design parsing', () => {
    const parsed = parseArgv(['design', '--provider', ' CLAUDE ', '--mode', 'DEFAULT', 'audit this layout'])
    expect(parsed.kind).toBe('design')
    if (parsed.kind !== 'design') throw new Error('expected design')
    expect(parsed.options.provider).toBe('claude')
    expect(parsed.options.mode).toBe('default')
  })

  it('keeps parser validation error messages stable via table-driven cases', () => {
    const errorCases: Array<{ argv: string[]; message: string }> = [
      { argv: ['run', '--provider', 'nope', 'hello'], message: "Unknown provider 'nope' for --provider" },
      {
        argv: ['run', '--output-format', 'xml', 'hello'],
        message: "Unknown output format 'xml' for --output-format",
      },
      { argv: ['run', '--timeout-ms', '0', 'hello'], message: 'Invalid value for --timeout-ms' },
      { argv: ['design', '--timeout-ms', '0', 'hello'], message: 'Invalid value for --timeout-ms' },
      { argv: ['debug', '--timeout-ms', '0'], message: 'Invalid value for --timeout-ms' },
      { argv: ['commit', '--timeout-ms', '0'], message: 'Invalid value for --timeout-ms' },
      { argv: ['commit', '--json'], message: '--json is not supported for yardmaster commit' },
      {
        argv: ['debug', 'TypeError'],
        message: "Unexpected positional argument 'TypeError'. Pipe terminal output into yardmaster debug instead.",
      },
      {
        argv: ['commit', 'extra'],
        message: "Unexpected positional argument 'extra'. yardmaster commit reads staged git changes directly.",
      },
      { argv: ['providers', 'doctor', '--provider'], message: 'Missing value for --provider' },
      { argv: ['config', 'set', 'mode.default'], message: 'Usage: yardmaster config set <key> <value>' },
      { argv: ['run', '--prompt-file', 'prompt.txt', 'hello'], message: '--prompt-file cannot be used with positional prompt text' },
      { argv: ['design', '--prompt-file', 'brief.txt', 'hello'], message: '--prompt-file cannot be used with positional prompt text' },
      { argv: ['presets', 'set'], message: 'Usage: yardmaster presets set <name>' },
      { argv: ['config', 'get', '--dry-run'], message: "Unknown config argument '--dry-run'" },
      { argv: ['presets', 'list', '--dry-run'], message: "Unknown presets argument '--dry-run'" },
      { argv: ['completion', 'powershell'], message: "Unknown completion argument 'powershell'" },
      { argv: ['help', 'unknown-topic'], message: "Unknown help topic 'unknown-topic'" },
    ]

    for (const testCase of errorCases) {
      expect(() => parseArgv(testCase.argv), `argv=${testCase.argv.join(' ')}`).toThrow(testCase.message)
    }
  })

  it('parses legacy shorthand prompt invocation', () => {
    const parsed = parseArgv(['hello world'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.prompt).toBe('hello world')
  })

  it('parses multi-token shorthand prompt invocation', () => {
    const parsed = parseArgv(['explain', 'recursion'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.prompt).toBe('explain recursion')
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

  it('parses run prompt-file input without positional prompt text', () => {
    const parsed = parseArgv(['run', '--provider', 'codex', '--prompt-file', 'prompt.txt'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.options.promptFile).toBe('prompt.txt')
    expect(parsed.prompt).toBeUndefined()
  })

  it('parses design prompt-file input without positional prompt text', () => {
    const parsed = parseArgv(['design', '--provider', 'codex', '--prompt-file', 'brief.txt'])
    expect(parsed.kind).toBe('design')
    if (parsed.kind !== 'design') throw new Error('expected design')
    expect(parsed.options.promptFile).toBe('brief.txt')
    expect(parsed.prompt).toBeUndefined()
  })

  it('treats unknown single token as shorthand prompt only when strict mode is disabled', () => {
    expect(() => parseArgv(['gleep'])).toThrow("Unknown command 'gleep'. Use 'yardmaster help' for usage.")

    const previous = process.env.YARDMASTER_STRICT_COMMANDS
    process.env.YARDMASTER_STRICT_COMMANDS = '0'
    try {
      const legacy = parseArgv(['gleep'])
      expect(legacy.kind).toBe('run')
      if (legacy.kind !== 'run') throw new Error('expected run')
      expect(legacy.prompt).toBe('gleep')
    } finally {
      if (previous === undefined) {
        delete process.env.YARDMASTER_STRICT_COMMANDS
      } else {
        process.env.YARDMASTER_STRICT_COMMANDS = previous
      }
    }
  })

  it('rejects unknown single token with leading global flags by default', () => {
    expect(() => parseArgv(['--json', 'gleep'])).toThrow("Unknown command 'gleep'. Use 'yardmaster help' for usage.")
  })

  it('allows unknown single token with leading global flags when strict mode is disabled', () => {
    const previous = process.env.YARDMASTER_STRICT_COMMANDS
    process.env.YARDMASTER_STRICT_COMMANDS = 'off'
    try {
      const parsed = parseArgv(['--json', 'gleep'])
      expect(parsed.kind).toBe('run')
      if (parsed.kind !== 'run') throw new Error('expected run')
      expect(parsed.globals.json).toBe(true)
      expect(parsed.prompt).toBe('gleep')
    } finally {
      if (previous === undefined) {
        delete process.env.YARDMASTER_STRICT_COMMANDS
      } else {
        process.env.YARDMASTER_STRICT_COMMANDS = previous
      }
    }
  })

  it('rejects unknown root token when shorthand looks like a mistyped command with flags', () => {
    expect(() => parseArgv(['reviw', '--all'])).toThrow("Unknown command 'reviw'. Use 'yardmaster help' for usage.")
  })

  it('rejects unknown multi-token input when it looks like a mistyped command', () => {
    expect(() => parseArgv(['reviw', 'all'])).toThrow("Unknown command 'reviw'. Use 'yardmaster help' for usage.")
  })

  it('preserves multi-token prompt shorthand by default', () => {
    const parsed = parseArgv(['explain', 'arrays'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.prompt).toBe('explain arrays')
  })

  it('parses providers and config command trees', () => {
    expect(parseArgv(['update']).kind).toBe('update')
    const updateDryRun = parseArgv(['update', '--dry-run', '--force'])
    expect(updateDryRun.kind).toBe('update')
    if (updateDryRun.kind !== 'update') throw new Error('expected update')
    expect(updateDryRun.safety.dryRun).toBe(true)
    expect(updateDryRun.safety.force).toBe(true)
    expect(parseArgv(['commit']).kind).toBe('commit')
    expect(parseArgv(['design', 'audit hierarchy']).kind).toBe('design')
    const designJson = parseArgv(['design', '--json', 'audit hierarchy'])
    expect(designJson.kind).toBe('design')
    if (designJson.kind !== 'design') throw new Error('expected design')
    expect(designJson.globals.json).toBe(true)
    const commitApply = parseArgv(['commit', '--apply', '--provider', 'gemini'])
    expect(commitApply.kind).toBe('commit')
    if (commitApply.kind !== 'commit') throw new Error('expected commit')
    expect(commitApply.options.apply).toBe(true)
    expect(commitApply.options.provider).toBe('gemini')
    expect(parseArgv(['debug']).kind).toBe('debug')
    const debugProvider = parseArgv(['debug', '--provider', 'gemini'])
    expect(debugProvider.kind).toBe('debug')
    if (debugProvider.kind !== 'debug') throw new Error('expected debug')
    expect(debugProvider.options.provider).toBe('gemini')
    const debugJson = parseArgv(['debug', '--json'])
    expect(debugJson.kind).toBe('debug')
    if (debugJson.kind !== 'debug') throw new Error('expected debug')
    expect(debugJson.globals.json).toBe(true)
    const debugFile = parseArgv(['debug', '--input-file', 'error.log'])
    expect(debugFile.kind).toBe('debug')
    if (debugFile.kind !== 'debug') throw new Error('expected debug')
    expect(debugFile.options.inputFile).toBe('error.log')

    expect(parseArgv(['review', '--all']).kind).toBe('review')
    const reviewStaged = parseArgv(['review', '--all', '--staged'])
    expect(reviewStaged.kind).toBe('review')
    if (reviewStaged.kind !== 'review') throw new Error('expected review')
    expect(reviewStaged.options.staged).toBe(true)
    const reviewBase = parseArgv(['review', '--all', '--base', 'origin/main'])
    expect(reviewBase.kind).toBe('review')
    if (reviewBase.kind !== 'review') throw new Error('expected review')
    expect(reviewBase.options.base).toBe('origin/main')
    const reviewJsonSchema = parseArgv(['review', '--json-schema'])
    expect(reviewJsonSchema.kind).toBe('review')
    if (reviewJsonSchema.kind !== 'review') throw new Error('expected review')
    expect(reviewJsonSchema.options.jsonSchema).toBe(true)
    const reviewSingle = parseArgv(['review', '--agent', 'cursor'])
    expect(reviewSingle.kind).toBe('review')
    if (reviewSingle.kind !== 'review') throw new Error('expected review')
    expect(reviewSingle.options.agent).toBe('cursor')
    const reviewAlias = parseArgv(['review', '--agent', 'cursor-agent'])
    expect(reviewAlias.kind).toBe('review')
    if (reviewAlias.kind !== 'review') throw new Error('expected review')
    expect(reviewAlias.options.agent).toBe('cursor')

    expect(parseArgv(['providers', 'list', '--json']).kind).toBe('providers-list')
    const completion = parseArgv(['completion', 'zsh'])
    expect(completion.kind).toBe('completion')
    if (completion.kind !== 'completion') throw new Error('expected completion')
    expect(completion.shell).toBe('zsh')
    expect(parseArgv(['providers', 'doctor', '--provider', 'gemini']).kind).toBe('providers-doctor')
    expect(parseArgv(['config', 'get']).kind).toBe('config-get')
    const configSet = parseArgv(['config', 'set', 'mode.default', 'fast', '--dry-run'])
    expect(configSet.kind).toBe('config-set')
    if (configSet.kind !== 'config-set') throw new Error('expected config-set')
    expect(configSet.safety.dryRun).toBe(true)
    expect(parseArgv(['presets', 'list']).kind).toBe('presets-list')
    expect(parseArgv(['presets', 'get', 'default']).kind).toBe('presets-get')
    const presetsSet = parseArgv(['presets', 'set', 'default', '--provider', 'codex', '--dry-run'])
    expect(presetsSet.kind).toBe('presets-set')
    if (presetsSet.kind !== 'presets-set') throw new Error('expected presets-set')
    expect(presetsSet.safety.dryRun).toBe(true)
    const presetsDelete = parseArgv(['presets', 'delete', 'default', '--force'])
    expect(presetsDelete.kind).toBe('presets-delete')
    if (presetsDelete.kind !== 'presets-delete') throw new Error('expected presets-delete')
    expect(presetsDelete.safety.force).toBe(true)
    const presetsUse = parseArgv(['presets', 'use', 'default', '--dry-run'])
    expect(presetsUse.kind).toBe('presets-use')
    if (presetsUse.kind !== 'presets-use') throw new Error('expected presets-use')
    expect(presetsUse.safety.dryRun).toBe(true)
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
    expect(() => parseArgv(['review', '--json-schema', '--all'])).toThrow(
      '--json-schema cannot be combined with review target or diff-source flags',
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

  it('keeps commit dispatch anchored to the first argv token', () => {
    const parsed = parseArgv(['--json', 'commit'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') throw new Error('expected run')
    expect(parsed.globals.json).toBe(true)
    expect(parsed.prompt).toBe('commit')
  })

  it('parses explicit help command variants at root', () => {
    const rootHelp = parseArgv(['help'])
    expect(rootHelp.kind).toBe('help')

    const runHelp = parseArgv(['help', 'run'])
    expect(runHelp.kind).toBe('help')
    if (runHelp.kind !== 'help') throw new Error('expected help')
    expect(runHelp.topic).toBe('run')

    const designHelp = parseArgv(['help', 'design'])
    expect(designHelp.kind).toBe('help')
    if (designHelp.kind !== 'help') throw new Error('expected help')
    expect(designHelp.topic).toBe('design')

    const commitHelp = parseArgv(['help', 'commit'])
    expect(commitHelp.kind).toBe('help')
    if (commitHelp.kind !== 'help') throw new Error('expected help')
    expect(commitHelp.topic).toBe('commit')

    const debugHelp = parseArgv(['help', 'debug'])
    expect(debugHelp.kind).toBe('help')
    if (debugHelp.kind !== 'help') throw new Error('expected help')
    expect(debugHelp.topic).toBe('debug')

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
