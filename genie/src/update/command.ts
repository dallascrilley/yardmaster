import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { RuntimeProviderError } from '../errors.js'

type UpdateStep = 'build' | 'link'

export type UpdateResult = {
  ok: boolean
  dryRun?: boolean
  packageRoot: string
  steps: Array<{
    step: UpdateStep
    ok: boolean
    code: number
    stderr: string
  }>
}

type RunCommandFn = (command: string, args: string[], cwd: string) => {
  code: number
  stderr: string
}

function defaultRunner(command: string, args: string[], cwd: string): { code: number; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })

  return {
    code: result.status ?? 1,
    stderr: (result.stderr ?? '').trim(),
  }
}

export function resolveCliPackageRoot(moduleUrl: string = import.meta.url): string {
  const override = process.env.GENIE_UPDATE_PACKAGE_ROOT?.trim()
  if (override) {
    return resolve(override)
  }
  const modulePath = fileURLToPath(moduleUrl)
  return resolve(dirname(modulePath), '..', '..')
}

export function formatUpdateResult(result: UpdateResult): string {
  if (result.dryRun) {
    return [
      'dryRun: true',
      `packageRoot: ${result.packageRoot}`,
      'plannedSteps:',
      ...result.steps.map((step) => `- ${step.step}`),
    ].join('\n')
  }

  if (result.ok) {
    return [
      `updated: true`,
      `packageRoot: ${result.packageRoot}`,
      'steps:',
      ...result.steps.map((step) => `- ${step.step}: ok`),
    ].join('\n')
  }

  const failed = result.steps.find((step) => !step.ok)
  return [
    'updated: false',
    `packageRoot: ${result.packageRoot}`,
    failed ? `failedStep: ${failed.step}` : 'failedStep: unknown',
    failed?.stderr ? `error: ${failed.stderr}` : 'error: update command failed',
  ].join('\n')
}

export function previewUpdateCommand(params?: { packageRoot?: string }): UpdateResult {
  const packageRoot = params?.packageRoot ?? resolveCliPackageRoot()
  return {
    ok: true,
    dryRun: true,
    packageRoot,
    steps: [
      { step: 'build', ok: true, code: 0, stderr: '' },
      { step: 'link', ok: true, code: 0, stderr: '' },
    ],
  }
}

export function runUpdateCommand(params?: { packageRoot?: string; runCommand?: RunCommandFn }): UpdateResult {
  const packageRoot = params?.packageRoot ?? resolveCliPackageRoot()
  const runner = params?.runCommand ?? defaultRunner
  const steps: UpdateResult['steps'] = []

  const build = runner('bun', ['run', 'build'], packageRoot)
  steps.push({
    step: 'build',
    ok: build.code === 0,
    code: build.code,
    stderr: build.stderr,
  })
  if (build.code !== 0) {
    throw new RuntimeProviderError(`Update failed during build: ${build.stderr || `exit ${build.code}`}`)
  }

  const link = runner('bun', ['link'], packageRoot)
  steps.push({
    step: 'link',
    ok: link.code === 0,
    code: link.code,
    stderr: link.stderr,
  })
  if (link.code !== 0) {
    throw new RuntimeProviderError(`Update failed during link: ${link.stderr || `exit ${link.code}`}`)
  }

  return {
    ok: true,
    packageRoot,
    steps,
  }
}
