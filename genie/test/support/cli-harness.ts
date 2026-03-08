import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { spawnSync, execFileSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export type MockBinaryOptions = {
  version?: string
  authStdout?: string
  authStderr?: string
  authExitCode?: number
  executionStdout?: string
  executionStderr?: string
  executionExitCode?: number
  executionSh?: string[]
}

export type CliRunOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
  input?: string
}

export type CliHarness = ReturnType<typeof createCliHarness>

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')
const bunBinary = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim() || 'bun'

function commandResult(options?: CliRunOptions): SpawnSyncOptionsWithStringEncoding {
  return {
    cwd: options?.cwd,
    encoding: 'utf8',
    env: options?.env,
    input: options?.input,
  }
}

export function createCliHarness(prefix = 'genie-cli-harness') {
  const rootDir = mkdtempSync(join(tmpdir(), `${prefix}-`))
  const homeDir = join(rootDir, 'home')
  const mockBinDir = join(rootDir, 'mock-bin')
  const workspaceDir = join(rootDir, 'workspace')
  mkdirSync(homeDir, { recursive: true })
  mkdirSync(mockBinDir, { recursive: true })
  mkdirSync(workspaceDir, { recursive: true })

  let linkedBinaryReady = false

  function cleanup(): void {
    rmSync(rootDir, { recursive: true, force: true })
  }

  function buildEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    return {
      ...process.env,
      HOME: homeDir,
      PATH: [mockBinDir, join(homeDir, '.bun', 'bin'), process.env.PATH ?? ''].join(delimiter),
      ...extra,
    }
  }

  function writeExecutable(name: string, lines: string[]): string {
    const target = join(mockBinDir, name)
    writeFileSync(target, `${lines.join('\n')}\n`, 'utf8')
    chmodSync(target, 0o755)
    return target
  }

  function writeMockBinary(name: string, options: MockBinaryOptions = {}): string {
    const lines = [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then',
      `  echo ${JSON.stringify(`${name} ${options.version ?? '1.0.0'}`)}`,
      '  exit 0',
      'fi',
      'if [ "$1" = "auth" ] && [ "$2" = "status" ]; then',
      ...(options.authStdout ? [`  echo ${JSON.stringify(options.authStdout)}`] : []),
      ...(options.authStderr ? [`  echo ${JSON.stringify(options.authStderr)} >&2`] : []),
      `  exit ${options.authExitCode ?? 0}`,
      'fi',
      ...(options.executionSh ?? [
        ...(options.executionStdout ? [`echo ${JSON.stringify(options.executionStdout)}`] : []),
        ...(options.executionStderr ? [`echo ${JSON.stringify(options.executionStderr)} >&2`] : []),
        `exit ${options.executionExitCode ?? 0}`,
      ]),
    ]

    return writeExecutable(name, lines)
  }

  function runSourceCli(args: string[], options: CliRunOptions = {}): SpawnSyncReturns<string> {
    return spawnSync(bunBinary, [sourceCliPath, ...args], commandResult({
      cwd: options.cwd ?? projectRoot,
      env: buildEnv(options.env),
      input: options.input,
    }))
  }

  function ensureLinkedBinary(options: { env?: NodeJS.ProcessEnv } = {}): void {
    if (linkedBinaryReady) return
    const env = buildEnv(options.env)

    const build = spawnSync(bunBinary, ['run', 'build'], commandResult({ cwd: projectRoot, env }))
    if (build.status !== 0) {
      throw new Error(`bun run build failed: ${(build.stderr || build.stdout).trim()}`)
    }

    const link = spawnSync(bunBinary, ['link'], commandResult({ cwd: projectRoot, env }))
    if (link.status !== 0) {
      throw new Error(`bun link failed: ${(link.stderr || link.stdout).trim()}`)
    }

    linkedBinaryReady = true
  }

  function runLinkedCli(args: string[], options: CliRunOptions = {}): SpawnSyncReturns<string> {
    ensureLinkedBinary({ env: options.env })
    return spawnSync('genie', args, commandResult({
      cwd: options.cwd ?? projectRoot,
      env: buildEnv(options.env),
      input: options.input,
    }))
  }

  function createWorkspace(name: string): string {
    const dir = join(workspaceDir, name)
    mkdirSync(dir, { recursive: true })
    return dir
  }

  function writeWorkspaceFile(workspace: string, relativePath: string, contents: string): string {
    const target = join(workspace, relativePath)
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, contents, 'utf8')
    return target
  }

  function initGitRepo(repoDir: string): void {
    execFileSync('git', ['init'], { cwd: repoDir, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.name', 'Genie Test'], { cwd: repoDir, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.email', 'genie@example.com'], { cwd: repoDir, stdio: 'ignore' })
  }

  function stageFile(repoDir: string, relativePath: string, contents: string): string {
    const target = writeWorkspaceFile(repoDir, relativePath, contents)
    execFileSync('git', ['add', relativePath], { cwd: repoDir, stdio: 'ignore' })
    return target
  }

  function commitAll(repoDir: string, message: string): void {
    execFileSync('git', ['commit', '-m', message], { cwd: repoDir, stdio: 'ignore' })
  }

  function readUserConfig(): unknown {
    return JSON.parse(readFileSync(join(homeDir, '.config', 'genie', 'config.json'), 'utf8'))
  }

  function createUpdateFixture(): { packageRoot: string; logFile: string } {
    const packageRoot = createWorkspace('update-fixture')
    const logFile = join(packageRoot, 'bun-invocations.log')
    writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: 'genie-update-fixture', private: true }), 'utf8')
    writeExecutable('bun', [
      '#!/bin/sh',
      'set -eu',
      'log_file="${GENIE_MOCK_BUN_LOG:?missing GENIE_MOCK_BUN_LOG}"',
      'printf "%s\n" "$*" >> "$log_file"',
      'exit 0',
    ])
    return { packageRoot, logFile }
  }

  return {
    rootDir,
    homeDir,
    mockBinDir,
    workspaceDir,
    projectRoot,
    sourceCliPath,
    cleanup,
    buildEnv,
    writeExecutable,
    writeMockBinary,
    runSourceCli,
    ensureLinkedBinary,
    runLinkedCli,
    createWorkspace,
    writeWorkspaceFile,
    initGitRepo,
    stageFile,
    commitAll,
    readUserConfig,
    createUpdateFixture,
  }
}
