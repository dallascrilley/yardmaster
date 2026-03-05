import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AggregatedProviderError } from '../src/errors.js'
import { defaultConfig, type GenieConfig } from '../src/config/schema.js'
import { loadConfig } from '../src/config/store.js'
import { runRequest, type RunRequestInput } from '../src/execution/run-request.js'
import type { CommandResult } from '../src/types.js'

type ProviderMock = {
  available: CommandResult
  auth: CommandResult
  execution: CommandResult
}

function createTempHome(): string {
  const home = join(tmpdir(), `genie-home-${randomUUID()}`)
  mkdirSync(home, { recursive: true })
  return home
}

function runnerFromScenarios(scenarios: Record<string, ProviderMock>) {
  return async (invocation: { command: string; args: string[] }): Promise<CommandResult> => {
    const scenario = scenarios[invocation.command]
    if (!scenario) {
      return { code: 127, stdout: '', stderr: `No mock for command ${invocation.command}` }
    }

    if (invocation.args[0] === '--version') {
      return scenario.available
    }

    if (invocation.args[0] === 'auth' && invocation.args[1] === 'status') {
      return scenario.auth
    }

    return scenario.execution
  }
}

async function runWithConfig(home: string, input: RunRequestInput, config: GenieConfig, scenarios: Record<string, ProviderMock>) {
  const originalHome = process.env.HOME
  process.env.HOME = home

  try {
    const result = await runRequest({
      input,
      config,
      runner: runnerFromScenarios(scenarios),
    })

    const saved = await loadConfig({ home })
    return { result, saved }
  } finally {
    process.env.HOME = originalHome
  }
}

describe('run-request integration', () => {
  const homes: string[] = []

  afterEach(() => {
    for (const home of homes) {
      rmSync(home, { recursive: true, force: true })
    }
    homes.length = 0
  })

  it('runs the first available provider and persists updated defaults', async () => {
    const home = createTempHome()
    homes.push(home)

    const config: GenieConfig = {
      ...defaultConfig,
      provider: {
        default: 'claude',
        fallbackOrder: ['codex', 'cursor-agent', 'gemini'],
      },
      workspace: {
        last: '/tmp/previous-workspace',
      },
    }

    const { result, saved } = await runWithConfig(
      home,
      {
        prompt: 'run this once',
        workspace: '/tmp/explicit-workspace',
        output: 'pretty',
      },
      config,
      {
        claude: {
          available: { code: 0, stdout: 'claude/ok', stderr: '' },
          auth: { code: 0, stdout: 'authed', stderr: '' },
          execution: { code: 0, stdout: 'claude response', stderr: '' },
        },
        codex: {
          available: { code: 0, stdout: 'codex/ok', stderr: '' },
          auth: { code: 0, stdout: 'authed', stderr: '' },
          execution: { code: 0, stdout: 'codex response', stderr: '' },
        },
        'cursor-agent': {
          available: { code: 0, stdout: 'cursor/ok', stderr: '' },
          auth: { code: 0, stdout: 'authed', stderr: '' },
          execution: { code: 0, stdout: 'cursor response', stderr: '' },
        },
        gemini: {
          available: { code: 0, stdout: 'gemini/ok', stderr: '' },
          auth: { code: 0, stdout: 'authed', stderr: '' },
          execution: { code: 0, stdout: 'gemini response', stderr: '' },
        },
      },
    )

    expect(result.provider).toBe('claude')
    expect(result.fallbackUsed).toBe(false)
    expect(result.response).toBe('claude response')
    expect(result.workspace).toBe('/tmp/explicit-workspace')
    expect(saved.provider.default).toBe('claude')
    expect(saved.workspace.last).toBe('/tmp/explicit-workspace')
    expect(saved.output.default).toBe('pretty')
  })

  it('falls back to the next provider when preflight fails', async () => {
    const home = createTempHome()
    homes.push(home)

    const config: GenieConfig = {
      ...defaultConfig,
      provider: {
        default: 'claude',
        fallbackOrder: ['codex', 'cursor-agent'],
      },
    }

    const { result, saved } = await runWithConfig(
      home,
      {
        prompt: 'fallback test',
        output: 'auto',
      },
      config,
      {
        claude: {
          available: { code: 1, stdout: '', stderr: 'not found' },
          auth: { code: 1, stdout: '', stderr: 'not found' },
          execution: { code: 1, stdout: '', stderr: 'should not run' },
        },
        codex: {
          available: { code: 0, stdout: 'codex/ok', stderr: '' },
          auth: { code: 0, stdout: 'authed', stderr: '' },
          execution: { code: 0, stdout: 'codex fallback response', stderr: '' },
        },
        'cursor-agent': {
          available: { code: 0, stdout: 'cursor/ok', stderr: '' },
          auth: { code: 0, stdout: 'authed', stderr: '' },
          execution: { code: 0, stdout: 'cursor response', stderr: '' },
        },
      },
    )

    expect(result.provider).toBe('codex')
    expect(result.fallbackUsed).toBe(true)
    expect(result.response).toBe('codex fallback response')
    expect(saved.provider.default).toBe('codex')
    expect(saved.model.byProvider).toEqual({})
  })

  it('throws an aggregated error when all mocked providers fail', async () => {
    const home = createTempHome()
    homes.push(home)

    const config: GenieConfig = {
      ...defaultConfig,
      provider: {
        default: 'claude',
        fallbackOrder: ['codex', 'cursor-agent'],
      },
    }

    const originalHome = process.env.HOME
    process.env.HOME = home

    const runner = runnerFromScenarios({
      claude: {
        available: { code: 1, stdout: '', stderr: 'missing claude' },
        auth: { code: 1, stdout: '', stderr: 'missing claude' },
        execution: { code: 1, stdout: '', stderr: 'missing claude' },
      },
      codex: {
        available: { code: 1, stdout: '', stderr: 'missing codex' },
        auth: { code: 1, stdout: '', stderr: 'missing codex' },
        execution: { code: 1, stdout: '', stderr: 'missing codex' },
      },
      'cursor-agent': {
        available: { code: 1, stdout: '', stderr: 'missing cursor' },
        auth: { code: 1, stdout: '', stderr: 'missing cursor' },
        execution: { code: 1, stdout: '', stderr: 'missing cursor' },
      },
    })

    try {
      await expect(
        runRequest({
          input: {
            prompt: 'no providers',
            output: 'json',
          },
          config,
          runner,
        }),
      ).rejects.toBeInstanceOf(AggregatedProviderError)

      const saved = await loadConfig({ home })
      expect(saved.provider.default).toBe('claude')
    } finally {
      process.env.HOME = originalHome
    }
  })

  it('does not persist defaults when persistLastUsed is disabled', async () => {
    const home = createTempHome()
    homes.push(home)

    const config: GenieConfig = {
      ...defaultConfig,
      provider: {
        default: 'claude',
        fallbackOrder: ['codex', 'cursor-agent', 'gemini'],
      },
      workspace: {
        last: '/tmp/original-workspace',
      },
    }

    const originalHome = process.env.HOME
    process.env.HOME = home

    try {
      const result = await runRequest({
        input: {
          prompt: 'review style execution',
          provider: 'codex',
          noFallback: true,
          output: 'plain',
        },
        config,
        runner: runnerFromScenarios({
          claude: {
            available: { code: 0, stdout: 'claude/ok', stderr: '' },
            auth: { code: 0, stdout: 'authed', stderr: '' },
            execution: { code: 0, stdout: 'claude response', stderr: '' },
          },
          codex: {
            available: { code: 0, stdout: 'codex/ok', stderr: '' },
            auth: { code: 0, stdout: 'authed', stderr: '' },
            execution: { code: 0, stdout: 'codex review', stderr: '' },
          },
          'cursor-agent': {
            available: { code: 0, stdout: 'cursor/ok', stderr: '' },
            auth: { code: 0, stdout: 'authed', stderr: '' },
            execution: { code: 0, stdout: 'cursor response', stderr: '' },
          },
          gemini: {
            available: { code: 0, stdout: 'gemini/ok', stderr: '' },
            auth: { code: 0, stdout: 'authed', stderr: '' },
            execution: { code: 0, stdout: 'gemini response', stderr: '' },
          },
        }),
        persistLastUsed: false,
      })

      expect(result.provider).toBe('codex')

      const saved = await loadConfig({ home })
      expect(saved.provider.default).toBe('claude')
      expect(saved.workspace.last).toBeUndefined()
    } finally {
      process.env.HOME = originalHome
    }
  })
})
