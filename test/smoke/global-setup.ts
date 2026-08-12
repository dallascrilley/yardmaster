import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { resolveYardmasterPackageRoot } from './support/yardmaster-root.js'

type DoctorEntry = {
  provider: string
  available: boolean
  authenticated: boolean
}

type DoctorEnvelope = {
  kind?: string
  ok?: boolean
  exitCode?: number
  providers?: DoctorEntry[]
}

export default function globalSetup(): void {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('smoke CI: GEMINI_API_KEY must be set so gemini can run in Actions')
  }

  const projectRoot = resolveYardmasterPackageRoot()
  const bunResult = spawnSync('which', ['bun'], { encoding: 'utf8' })
  const bunBinary = bunResult.status === 0 ? bunResult.stdout.trim() : 'bun'
  const cli = join(projectRoot, 'src', 'bin', 'yardmaster.ts')

  const result = spawnSync(bunBinary, [cli, 'providers', 'doctor', '--json'], {
    encoding: 'utf8',
    timeout: 120_000,
    cwd: projectRoot,
  })

  const raw = typeof result.stdout === 'string' ? result.stdout : ''
  if (result.status !== 0) {
    throw new Error(
      `smoke CI: providers doctor exited ${String(result.status)}: ${String(result.stderr ?? '')} ${raw.slice(0, 500)}`,
    )
  }

  let envelope: DoctorEnvelope
  try {
    envelope = JSON.parse(raw) as DoctorEnvelope
  } catch {
    throw new Error(`smoke CI: failed to parse providers doctor JSON: ${raw.slice(0, 500)}`)
  }

  if (envelope.kind === 'error' || envelope.ok !== true || (envelope.exitCode ?? 0) !== 0) {
    throw new Error(
      `smoke CI: providers doctor JSON indicates failure (kind=${String(envelope.kind)} ok=${String(envelope.ok)} exitCode=${String(envelope.exitCode)}): ${raw.slice(0, 500)}`,
    )
  }

  if (!Array.isArray(envelope.providers) || envelope.providers.length === 0) {
    throw new Error('smoke CI: providers doctor returned no provider entries')
  }

  const gemini = envelope.providers.find((p) => p.provider === 'gemini')
  if (!gemini?.available || !gemini?.authenticated) {
    throw new Error('smoke CI: gemini must be available and authenticated in doctor output')
  }
}
