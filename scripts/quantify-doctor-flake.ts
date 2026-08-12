import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type Mode = 'human' | 'json'

type ModeSummary = {
  mode: Mode
  runs: number
  codes: Record<number, number>
  timeouts: number
  minMs: number
  p50Ms: number
  maxMs: number
}

type Options = {
  runs: number
  provider?: string
  failOnFlake: boolean
}

function parseArgs(argv: string[]): Options {
  let runs = 20
  let provider: string | undefined
  let failOnFlake = false

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--runs') {
      const value = argv[i + 1]
      if (!value) {
        throw new Error('Missing value for --runs')
      }
      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --runs value '${value}'`)
      }
      runs = parsed
      i += 1
      continue
    }

    if (token === '--provider') {
      const value = argv[i + 1]
      if (!value) {
        throw new Error('Missing value for --provider')
      }
      provider = value
      i += 1
      continue
    }

    if (token === '--fail-on-flake') {
      failOnFlake = true
      continue
    }

    if (token === '--help' || token === '-h') {
      printHelp()
      process.exit(0)
    }

    throw new Error(`Unknown argument '${token}'`)
  }

  return { runs, provider, failOnFlake }
}

function printHelp(): void {
  console.log('Usage: bun run scripts/quantify-doctor-flake.ts [--runs <n>] [--provider <id>] [--fail-on-flake]')
  console.log('Runs providers doctor in human and json modes repeatedly, then prints flake/latency summary.')
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.floor((sorted[middle - 1] + sorted[middle]) / 2)
  }
  return sorted[middle] ?? 0
}

function runOnce(mode: Mode, provider?: string): { code: number; durationMs: number; timeout: boolean } {
  const homeDir = mkdtempSync(join(tmpdir(), 'yardmaster-home-'))
  const xdgDir = mkdtempSync(join(tmpdir(), 'yardmaster-xdg-'))
  try {
    const startedAt = Date.now()
    const args = ['src/bin/yardmaster.ts', 'providers', 'doctor']
    if (provider) {
      args.push('--provider', provider)
    }
    if (mode === 'json') {
      args.push('--json')
    }

    const result = spawnSync('bun', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: homeDir,
        XDG_CONFIG_HOME: xdgDir,
      },
    })

    const durationMs = Date.now() - startedAt
    const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toLowerCase()
    const timeout = combinedOutput.includes('timed out') || combinedOutput.includes('timeout')

    return {
      code: result.status ?? 1,
      durationMs,
      timeout,
    }
  } finally {
    rmSync(homeDir, { recursive: true, force: true })
    rmSync(xdgDir, { recursive: true, force: true })
  }
}

function summarize(mode: Mode, runs: number, provider?: string): ModeSummary {
  const durations: number[] = []
  const codes: Record<number, number> = {}
  let timeouts = 0

  for (let i = 0; i < runs; i += 1) {
    const result = runOnce(mode, provider)
    durations.push(result.durationMs)
    codes[result.code] = (codes[result.code] ?? 0) + 1
    if (result.timeout) {
      timeouts += 1
    }
  }

  return {
    mode,
    runs,
    codes,
    timeouts,
    minMs: Math.min(...durations),
    p50Ms: median(durations),
    maxMs: Math.max(...durations),
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  const summaries = [
    summarize('human', options.runs, options.provider),
    summarize('json', options.runs, options.provider),
  ]

  for (const item of summaries) {
    console.log(
      `${item.mode}: runs=${item.runs} codes=${JSON.stringify(item.codes)} timeouts=${item.timeouts} min_ms=${item.minMs} p50_ms=${item.p50Ms} max_ms=${item.maxMs}`,
    )
  }

  if (options.failOnFlake) {
    const hasFailure = summaries.some((item) => item.timeouts > 0 || Object.keys(item.codes).some((code) => code !== '0'))
    if (hasFailure) {
      process.exit(1)
    }
  }
}

main()
