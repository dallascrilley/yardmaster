import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

import { createCliHarness, type CliHarness } from './support/cli-harness.js'

const criticalPathCommands = [
  'bootstrap: bare invocation/help/version/completion',
  'prompt flows: run/design/debug/commit',
  'state flows: providers/config/presets/review/update',
] as const

describe('cli critical path integration', () => {
  const harnesses: CliHarness[] = []

  afterEach(() => {
    for (const harness of harnesses) {
      harness.cleanup()
    }
    harnesses.length = 0
  })

  function useHarness(prefix: string): CliHarness {
    const harness = createCliHarness(prefix)
    harnesses.push(harness)
    return harness
  }

  it('tracks the shipped critical-path matrix in one local suite', () => {
    expect(criticalPathCommands).toEqual([
      'bootstrap: bare invocation/help/version/completion',
      'prompt flows: run/design/debug/commit',
      'state flows: providers/config/presets/review/update',
    ])
  })

  it('validates bootstrap commands through the source CLI', () => {
    const harness = useHarness('critical-bootstrap')

    const bare = harness.runSourceCli([])
    expect(bare.status).toBe(0)
    expect(bare.stdout).toContain('Unified AI CLI for prompt execution, terminal debugging, diff review, and provider-aware automation.')

    const help = harness.runSourceCli(['help', 'run'])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('Usage: genie run [options] <prompt>')

    const version = harness.runSourceCli(['--version'])
    expect(version.status).toBe(0)
    expect(version.stdout.trim()).toMatch(/^0\.1\.0$/)

    const completion = harness.runSourceCli(['completion', 'bash'])
    expect(completion.status).toBe(0)
    expect(completion.stdout).toContain('complete -F _genie genie')
  })

  it('validates prompt flows unattended, including run precedence persistence', () => {
    const harness = useHarness('critical-prompts')
    harness.writeMockBinary('claude', { executionStdout: 'claude response' })
    harness.writeMockBinary('codex', { executionStdout: 'feat(cli): generated commit message' })

    const projectRepo = harness.createWorkspace('project-repo')
    harness.initGitRepo(projectRepo)
    harness.writeWorkspaceFile(
      projectRepo,
      '.genie/config.json',
      JSON.stringify({ provider: { default: 'codex', fallbackOrder: ['codex', 'claude', 'gemini', 'cursor-agent'] } }, null, 2),
    )

    const promptFile = harness.writeWorkspaceFile(projectRepo, 'prompt.txt', 'prompt from file\n')
    const run = harness.runSourceCli(
      ['run', '--provider', 'claude', '--model', 'sonnet-3.7', '--no-fallback', '--json', '--prompt-file', promptFile],
      {
        cwd: projectRepo,
        env: {
          GENIE_PROVIDER: 'gemini',
          GENIE_MODEL: 'gemini-pro',
        },
      },
    )
    expect(run.status).toBe(0)
    const runPayload = JSON.parse(run.stdout)
    expect(runPayload).toMatchObject({
      kind: 'run_result',
      provider: 'claude',
      response: 'claude response',
      ok: true,
    })

    const savedConfig = harness.readUserConfig() as {
      provider: { default: string }
      model: { byProvider: Record<string, string> }
      workspace: { last: string }
    }
    expect(savedConfig.provider.default).toBe('claude')
    expect(savedConfig.model.byProvider.claude).toBe('sonnet-3.7')
    expect(savedConfig.workspace.last).toBe(realpathSync(projectRepo))

    const design = harness.runSourceCli(['design', '--provider', 'claude', '--no-fallback', 'review the hero'], { cwd: projectRepo })
    expect(design.status).toBe(0)
    expect(design.stdout).toContain('claude response')

    const debug = harness.runSourceCli(['debug', '--provider', 'claude', '--no-fallback'], {
      cwd: projectRepo,
      input: 'TypeError: mocked failure\n',
    })
    expect(debug.status).toBe(0)
    expect(debug.stdout).toContain('claude response')

    harness.stageFile(projectRepo, 'src/example.ts', 'export const value = 1\n')
    const commit = harness.runSourceCli(['commit', '--provider', 'codex', '--no-fallback'], { cwd: projectRepo })
    expect(commit.status).toBe(0)
    expect(commit.stdout.trim()).toBe('feat(cli): generated commit message')
  })

  it('validates state flows unattended, including review modes and mocked update execution', { timeout: 20_000 }, () => {
    const harness = useHarness('critical-state')
    for (const provider of ['claude', 'codex', 'gemini', 'cursor-agent'] as const) {
      harness.writeMockBinary(provider, {
        executionStdout: `${provider} review response`,
      })
    }

    const workspace = harness.createWorkspace('state-workspace')
    harness.initGitRepo(workspace)

    const providersList = harness.runSourceCli(['providers', 'list', '--json'], { cwd: workspace })
    expect(providersList.status).toBe(0)
    expect(JSON.parse(providersList.stdout)).toMatchObject({ kind: 'providers_list', ok: true })

    const providersDoctor = harness.runSourceCli(['providers', 'doctor', '--provider', 'claude', '--json'], { cwd: workspace })
    expect(providersDoctor.status).toBe(0)
    expect(JSON.parse(providersDoctor.stdout)).toMatchObject({
      kind: 'providers_doctor',
      providers: [{ provider: 'claude', available: true, authenticated: true }],
    })

    const configInit = harness.runSourceCli(['config', 'init', '--json'], { cwd: workspace })
    expect(configInit.status).toBe(0)
    const configSet = harness.runSourceCli(['config', 'set', 'provider.default', 'claude', '--json'], { cwd: workspace })
    expect(configSet.status).toBe(0)
    const configGet = harness.runSourceCli(['config', 'get', 'provider.default', '--json'], { cwd: workspace })
    expect(JSON.parse(configGet.stdout)).toMatchObject({ key: 'provider.default', value: 'claude' })
    const configPath = harness.runSourceCli(['config', 'path', '--json'], { cwd: workspace })
    expect(JSON.parse(configPath.stdout)).toMatchObject({ kind: 'config_path', ok: true })

    const presetSet = harness.runSourceCli(['presets', 'set', 'nightly', '--provider', 'claude', '--json'], { cwd: workspace })
    expect(presetSet.status).toBe(0)
    const presetGet = harness.runSourceCli(['presets', 'get', 'nightly', '--json'], { cwd: workspace })
    expect(JSON.parse(presetGet.stdout)).toMatchObject({ name: 'nightly', preset: { provider: 'claude' } })
    const presetList = harness.runSourceCli(['presets', 'list', '--json'], { cwd: workspace })
    expect(JSON.parse(presetList.stdout)).toMatchObject({ kind: 'presets_list', ok: true })
    const presetUse = harness.runSourceCli(['presets', 'use', 'nightly', '--json'], { cwd: workspace })
    expect(JSON.parse(presetUse.stdout)).toMatchObject({ kind: 'presets_use', default: 'nightly' })
    const presetDelete = harness.runSourceCli(['presets', 'delete', 'nightly', '--json', '--force'], { cwd: workspace })
    expect(JSON.parse(presetDelete.stdout)).toMatchObject({ kind: 'presets_delete', deleted: 'nightly' })

    const diffFile = harness.writeWorkspaceFile(
      workspace,
      'change.diff',
      ['diff --git a/src/a.ts b/src/a.ts', '--- a/src/a.ts', '+++ b/src/a.ts', '+const value = 1'].join('\n'),
    )
    const reviewFromFile = harness.runSourceCli(['review', '--agent', 'codex', '--diff-file', diffFile, '--json'], { cwd: workspace })
    expect(reviewFromFile.status).toBe(0)
    expect(JSON.parse(reviewFromFile.stdout)).toMatchObject({
      kind: 'review_result',
      mode: 'single',
      targets: ['codex'],
      source: `file:${diffFile}`,
      summary: { succeeded: 1, failed: 0 },
    })

    harness.stageFile(workspace, 'src/staged.ts', 'export const staged = true\n')
    const reviewStaged = harness.runSourceCli(['review', '--agent', 'claude', '--staged', '--json'], { cwd: workspace })
    expect(reviewStaged.status).toBe(0)
    expect(JSON.parse(reviewStaged.stdout)).toMatchObject({
      kind: 'review_result',
      targets: ['claude'],
      source: 'git diff --cached',
    })

    harness.commitAll(workspace, 'feat: baseline')
    harness.stageFile(workspace, 'src/base.ts', 'export const base = 2\n')
    harness.commitAll(workspace, 'feat: change for base review')
    const reviewBase = harness.runSourceCli(['review', '--agent', 'gemini', '--base', 'HEAD~1', '--json'], {
      cwd: workspace,
      env: {
        GEMINI_API_KEY: 'test-key',
      },
    })
    expect(reviewBase.status).toBe(0)
    expect(JSON.parse(reviewBase.stdout)).toMatchObject({
      kind: 'review_result',
      targets: ['gemini'],
    })

    const reviewAll = harness.runSourceCli(['review', '--all', '--base', 'HEAD~1', '--json'], {
      cwd: workspace,
      env: {
        GEMINI_API_KEY: 'test-key',
      },
    })
    expect(reviewAll.status).toBe(0)
    expect(JSON.parse(reviewAll.stdout)).toMatchObject({
      kind: 'review_result',
      mode: 'all',
      targets: ['codex', 'claude', 'gemini', 'cursor'],
      summary: { total: 4, failed: 0 },
    })

    const updateDryRun = harness.runSourceCli(['update', '--dry-run', '--json'], { cwd: workspace })
    expect(updateDryRun.status).toBe(0)
    expect(JSON.parse(updateDryRun.stdout)).toMatchObject({
      kind: 'update_result',
      dryRun: true,
      steps: [{ step: 'build' }, { step: 'link' }],
    })

    const updateFixture = harness.createUpdateFixture()
    const update = harness.runSourceCli(['update', '--force', '--json'], {
      cwd: workspace,
      env: {
        GENIE_UPDATE_PACKAGE_ROOT: updateFixture.packageRoot,
        GENIE_MOCK_BUN_LOG: updateFixture.logFile,
      },
    })
    expect(update.status).toBe(0)
    expect(JSON.parse(update.stdout)).toMatchObject({
      kind: 'update_result',
      ok: true,
      steps: [
        { step: 'build', ok: true, code: 0 },
        { step: 'link', ok: true, code: 0 },
      ],
    })
    expect(readFileSync(updateFixture.logFile, 'utf8').trim().split(/\r?\n/)).toEqual(['run build', 'link'])
  })
})
